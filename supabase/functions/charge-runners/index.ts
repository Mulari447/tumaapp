import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scheduled endpoint to bill runners weekly. Intended to be called via cron or manual trigger.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find subscriptions that are active or in trial and need processing
    const { data: subscriptions, error: subError } = await supabase
      .from("runner_subscriptions")
      .select("*")
      .eq("active", true);

    if (subError) throw subError;

    const results: Array<{ runner_id: string; status: string; message: string }> = [];

    for (const sub of subscriptions || []) {
      try {
        // helper to pause briefly between retries
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const MAX_ATTEMPTS = 3;
        // If still in trial and trial ended
        if (sub.status === "trial" && new Date(sub.trial_end_at) <= new Date(now)) {
          // Check if runner completed at least 1 errand since subscription start
          const { data: completedErrands } = await supabase
            .from("errands")
            .select("id")
            .eq("runner_id", sub.runner_id)
            .gte("completed_at", sub.started_at)
            .limit(1);

          if (completedErrands && completedErrands.length > 0) {
            // Activate subscription (start billing cycle)
            const nextBilling = new Date(sub.trial_end_at).toISOString();
            await supabase
              .from("runner_subscriptions")
              .update({ status: "active", next_billing_at: nextBilling, last_billed_at: null })
              .eq("id", sub.id);

            results.push({ runner_id: sub.runner_id, status: "activated", message: `Activated and will bill from ${nextBilling}` });
          } else {
            // Pause subscription until runner completes a gig
            await supabase
              .from("runner_subscriptions")
              .update({ status: "paused", active: false })
              .eq("id", sub.id);

            // Notify runner
            await supabase.rpc("create_notification", {
              p_user_id: sub.runner_id,
              p_type: "admin_action",
              p_title: "Billing Paused",
              p_message: "Your billing was paused because no completed gig was detected during the trial week. Complete a gig to activate billing.",
              p_errand_id: null,
            });

            results.push({ runner_id: sub.runner_id, status: "paused", message: "Paused - no completed gigs during trial" });
          }

          continue;
        }

        // If active and next_billing_at set and due now or earlier
        if (sub.status === "active") {
          const due = sub.next_billing_at ? new Date(sub.next_billing_at) : null;
          if (due && due <= new Date(now)) {
            // Get runner wallet
            const { data: wallet } = await supabase
              .from("wallets")
              .select("*")
              .eq("user_id", sub.runner_id)
              .single();

            const fee = Number(sub.weekly_fee || 300);

            if (wallet) {
              let currentBalance = parseFloat(String(wallet.balance || 0));
              // If balance enough, attempt to charge with retries for transient errors
              if (currentBalance >= fee) {
                let charged = false;
                let attempt = 0;
                let lastError: string | null = null;

                while (attempt < MAX_ATTEMPTS && !charged) {
                  attempt += 1;
                  try {
                    // Perform atomic-ish operations: create transaction and update wallet
                    await supabase.from("transactions").insert({
                      wallet_id: wallet.id,
                      type: "withdrawal",
                      amount: fee,
                      status: "completed",
                      description: `Weekly subscription fee`,
                    });

                    await supabase.from("wallets").update({ balance: currentBalance - fee }).eq("id", wallet.id);

                    // Update subscription billing metadata
                    const next = new Date(due.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                    await supabase.from("runner_subscriptions").update({ last_billed_at: now, next_billing_at: next, billing_attempts: 0, last_billing_error: null }).eq("id", sub.id);

                    // Notify runner
                    await supabase.rpc("create_notification", {
                      p_user_id: sub.runner_id,
                      p_type: "job_paid",
                      p_title: "Subscription Charged",
                      p_message: `KES ${fee.toFixed(2)} charged for weekly subscription. Next billing: ${next}`,
                      p_errand_id: null,
                    });

                    results.push({ runner_id: sub.runner_id, status: "billed", message: `Charged KES ${fee}` });
                    charged = true;
                  } catch (chargeErr) {
                    lastError = String(chargeErr);
                    console.warn(`Charge attempt ${attempt} failed for ${sub.id}:`, chargeErr);
                    // brief backoff before retry
                    await sleep(500 * attempt);
                  }
                }

                if (!charged) {
                  // Record failure
                  const attempts = (sub.billing_attempts || 0) + 1;
                  const updates: any = { billing_attempts: attempts, last_billing_error: lastError };
                  // Pause only after repeated failures
                  if (attempts >= MAX_ATTEMPTS) {
                    updates.status = "paused";
                    updates.active = false;
                  }
                  await supabase.from("runner_subscriptions").update(updates).eq("id", sub.id);

                  if (attempts >= MAX_ATTEMPTS) {
                    await supabase.rpc("create_notification", {
                      p_user_id: sub.runner_id,
                      p_type: "admin_action",
                      p_title: "Subscription Paused",
                      p_message: "Your subscription was paused due to repeated billing failures. Please top up your wallet or contact support.",
                      p_errand_id: null,
                    });
                    results.push({ runner_id: sub.runner_id, status: "paused_billing_failures", message: "Paused after repeated billing failures" });
                  } else {
                    results.push({ runner_id: sub.runner_id, status: "billing_error", message: lastError || "Unknown error" });
                  }
                }
              } else {
                // Insufficient funds: increment attempts and only pause after threshold
                const attempts = (sub.billing_attempts || 0) + 1;
                const updates: any = { billing_attempts: attempts, last_billing_error: "insufficient_funds" };
                if (attempts >= MAX_ATTEMPTS) {
                  updates.status = "paused";
                  updates.active = false;
                }
                await supabase.from("runner_subscriptions").update(updates).eq("id", sub.id);

                // Notify runner
                await supabase.rpc("create_notification", {
                  p_user_id: sub.runner_id,
                  p_type: "admin_action",
                  p_title: attempts >= MAX_ATTEMPTS ? "Subscription Paused" : "Low Wallet Balance",
                  p_message: attempts >= MAX_ATTEMPTS ?
                    "Your subscription was paused due to repeated insufficient funds. Please top up your wallet." :
                    "Your subscription billing failed due to insufficient funds. Please top up your wallet.",
                  p_errand_id: null,
                });

                results.push({ runner_id: sub.runner_id, status: attempts >= MAX_ATTEMPTS ? "paused_insufficient_funds" : "insufficient_funds", message: "Insufficient funds" });
              }
            } else {
                results.push({ runner_id: sub.runner_id, status: "no_wallet", message: "No wallet found" });
            }
          }
        }
      } catch (err) {
        console.error("Billing error for subscription", sub.id, err);
        results.push({ runner_id: sub.runner_id, status: "error", message: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Charge runners error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
