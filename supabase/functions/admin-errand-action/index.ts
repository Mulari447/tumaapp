import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminActionRequest {
  action: "reassign" | "suspend_runner" | "reinstate_runner" | "resolve_dispute" | "cancel";
  errand_id?: string;
  runner_id?: string;
  new_runner_id?: string;
  reason: string;
  resolution?: "confirm" | "refund";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: isAdminResult } = await supabase.rpc("is_admin");
    if (isAdminResult !== true) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, errand_id, runner_id, new_runner_id, reason, resolution }: AdminActionRequest = await req.json();

    if (!action || !reason) {
      return new Response(JSON.stringify({ error: "action and reason are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let result: Record<string, unknown> = { success: true };

    switch (action) {
      case "reassign": {
        if (!errand_id || !new_runner_id) {
          return new Response(JSON.stringify({ error: "errand_id and new_runner_id required for reassign" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get errand
        const { data: errand } = await supabase
          .from("errands")
          .select("*")
          .eq("id", errand_id)
          .single();

        if (!errand) {
          return new Response(JSON.stringify({ error: "Errand not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const oldRunnerId = errand.runner_id;

        // Update errand with new runner
        await supabase
          .from("errands")
          .update({ 
            runner_id: new_runner_id,
            status: "assigned",
            accepted_at: now,
            started_at: null,
            completed_at: null,
          })
          .eq("id", errand_id);

        // Log decision
        await supabase.from("admin_decisions").insert({
          errand_id,
          runner_id: oldRunnerId,
          admin_id: user.id,
          decision_type: "reassign",
          reason,
        });

        // Notify old runner
        if (oldRunnerId) {
          await supabase.rpc("create_notification", {
            p_user_id: oldRunnerId,
            p_type: "job_reassigned",
            p_title: "Errand Reassigned",
            p_message: `The errand "${errand.title}" has been reassigned to another runner.`,
            p_errand_id: errand_id,
          });
        }

        // Notify new runner
        await supabase.rpc("create_notification", {
          p_user_id: new_runner_id,
          p_type: "job_accepted",
          p_title: "New Errand Assigned",
          p_message: `You have been assigned to the errand "${errand.title}".`,
          p_errand_id: errand_id,
        });

        // Notify customer
        await supabase.rpc("create_notification", {
          p_user_id: errand.customer_id,
          p_type: "job_reassigned",
          p_title: "Runner Changed",
          p_message: `A new runner has been assigned to your errand "${errand.title}".`,
          p_errand_id: errand_id,
        });

        result.message = "Errand reassigned successfully";
        break;
      }

      case "suspend_runner": {
        if (!runner_id) {
          return new Response(JSON.stringify({ error: "runner_id required for suspension" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update runner verification status
        await supabase
          .from("profiles")
          .update({ 
            verification_status: "rejected",
            admin_notes: `Suspended: ${reason}`,
          })
          .eq("id", runner_id);

        // Log decision
        await supabase.from("admin_decisions").insert({
          runner_id,
          admin_id: user.id,
          decision_type: "suspend",
          reason,
        });

        // Notify runner
        await supabase.rpc("create_notification", {
          p_user_id: runner_id,
          p_type: "runner_suspended",
          p_title: "Account Suspended",
          p_message: `Your runner account has been suspended. Reason: ${reason}`,
          p_errand_id: null,
        });

        result.message = "Runner suspended successfully";
        break;
      }

      case "reinstate_runner": {
        if (!runner_id) {
          return new Response(JSON.stringify({ error: "runner_id required for reinstatement" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update runner verification status
        await supabase
          .from("profiles")
          .update({ 
            verification_status: "verified",
            admin_notes: `Reinstated: ${reason}`,
          })
          .eq("id", runner_id);

        // Log decision
        await supabase.from("admin_decisions").insert({
          runner_id,
          admin_id: user.id,
          decision_type: "reinstate",
          reason,
        });

        // Notify runner
        await supabase.rpc("create_notification", {
          p_user_id: runner_id,
          p_type: "runner_reinstated",
          p_title: "Account Reinstated",
          p_message: `Your runner account has been reinstated. You can now accept errands again.`,
          p_errand_id: null,
        });

        result.message = "Runner reinstated successfully";
        break;
      }

      case "resolve_dispute": {
        if (!errand_id || !resolution) {
          return new Response(JSON.stringify({ error: "errand_id and resolution required for dispute resolution" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: errand } = await supabase
          .from("errands")
          .select("*")
          .eq("id", errand_id)
          .single();

        if (!errand) {
          return new Response(JSON.stringify({ error: "Errand not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (resolution === "confirm") {
          // Confirm the errand - same as customer confirmation
          await supabase
            .from("errands")
            .update({ 
              status: "confirmed",
              confirmed_at: now,
              admin_notes: `Dispute resolved by admin: ${reason}`,
            })
            .eq("id", errand_id);

          // Release payment (handled by status update)
          // Get wallets and process payment
          const { data: customerWallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", errand.customer_id)
            .single();

          const { data: runnerWallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", errand.runner_id)
            .single();

          if (customerWallet && runnerWallet) {
            const totalAmount = parseFloat(errand.total_price || errand.budget);
            const commission = totalAmount * 0.15;
            const runnerAmount = totalAmount - commission;

            if (parseFloat(customerWallet.escrow_balance) >= totalAmount) {
              await supabase
                .from("wallets")
                .update({ escrow_balance: parseFloat(customerWallet.escrow_balance) - totalAmount })
                .eq("id", customerWallet.id);

              await supabase
                .from("wallets")
                .update({ balance: parseFloat(runnerWallet.balance) + runnerAmount })
                .eq("id", runnerWallet.id);

              await supabase.from("transactions").insert([
                {
                  wallet_id: runnerWallet.id,
                  errand_id,
                  type: "errand_release",
                  amount: runnerAmount,
                  status: "completed",
                  description: "Dispute resolved in runner's favor",
                },
              ]);

              await supabase
                .from("errands")
                .update({ status: "paid", paid_at: now })
                .eq("id", errand_id);
            }
          }

          // Notify both parties
          await supabase.rpc("create_notification", {
            p_user_id: errand.customer_id,
            p_type: "admin_action",
            p_title: "Dispute Resolved",
            p_message: `The dispute for "${errand.title}" has been resolved. Payment released to runner.`,
            p_errand_id: errand_id,
          });

          if (errand.runner_id) {
            await supabase.rpc("create_notification", {
              p_user_id: errand.runner_id,
              p_type: "job_paid",
              p_title: "Dispute Resolved - Payment Released",
              p_message: `The dispute for "${errand.title}" has been resolved in your favor.`,
              p_errand_id: errand_id,
            });
          }

        } else if (resolution === "refund") {
          // Refund to customer
          const { data: customerWallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", errand.customer_id)
            .single();

          if (customerWallet) {
            const totalAmount = parseFloat(errand.total_price || errand.budget);
            
            // Move from escrow back to balance
            if (parseFloat(customerWallet.escrow_balance) >= totalAmount) {
              await supabase
                .from("wallets")
                .update({ 
                  escrow_balance: parseFloat(customerWallet.escrow_balance) - totalAmount,
                  balance: parseFloat(customerWallet.balance) + totalAmount,
                })
                .eq("id", customerWallet.id);

              await supabase.from("transactions").insert({
                wallet_id: customerWallet.id,
                errand_id,
                type: "refund",
                amount: totalAmount,
                status: "completed",
                description: "Dispute resolved - refund issued",
              });
            }
          }

          await supabase
            .from("errands")
            .update({ 
              status: "cancelled",
              admin_notes: `Dispute resolved with refund: ${reason}`,
            })
            .eq("id", errand_id);

          // Notify both parties
          await supabase.rpc("create_notification", {
            p_user_id: errand.customer_id,
            p_type: "admin_action",
            p_title: "Dispute Resolved - Refund Issued",
            p_message: `The dispute for "${errand.title}" has been resolved. Full refund issued.`,
            p_errand_id: errand_id,
          });

          if (errand.runner_id) {
            await supabase.rpc("create_notification", {
              p_user_id: errand.runner_id,
              p_type: "admin_action",
              p_title: "Dispute Resolved",
              p_message: `The dispute for "${errand.title}" has been resolved. Customer refunded.`,
              p_errand_id: errand_id,
            });
          }
        }

        // Log decision
        await supabase.from("admin_decisions").insert({
          errand_id,
          runner_id: errand.runner_id,
          admin_id: user.id,
          decision_type: `dispute_${resolution}`,
          reason,
        });

        result.message = `Dispute resolved with ${resolution}`;
        break;
      }

      case "cancel": {
        if (!errand_id) {
          return new Response(JSON.stringify({ error: "errand_id required for cancellation" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: errand } = await supabase
          .from("errands")
          .select("*")
          .eq("id", errand_id)
          .single();

        if (!errand) {
          return new Response(JSON.stringify({ error: "Errand not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Refund escrow if any
        const { data: customerWallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", errand.customer_id)
          .single();

        if (customerWallet) {
          const totalAmount = parseFloat(errand.total_price || errand.budget);
          if (parseFloat(customerWallet.escrow_balance) >= totalAmount) {
            await supabase
              .from("wallets")
              .update({ 
                escrow_balance: parseFloat(customerWallet.escrow_balance) - totalAmount,
                balance: parseFloat(customerWallet.balance) + totalAmount,
              })
              .eq("id", customerWallet.id);

            await supabase.from("transactions").insert({
              wallet_id: customerWallet.id,
              errand_id,
              type: "refund",
              amount: totalAmount,
              status: "completed",
              description: `Admin cancelled errand: ${reason}`,
            });
          }
        }

        await supabase
          .from("errands")
          .update({ 
            status: "cancelled",
            admin_notes: `Cancelled by admin: ${reason}`,
          })
          .eq("id", errand_id);

        // Log decision
        await supabase.from("admin_decisions").insert({
          errand_id,
          runner_id: errand.runner_id,
          admin_id: user.id,
          decision_type: "cancel",
          reason,
        });

        // Notify parties
        await supabase.rpc("create_notification", {
          p_user_id: errand.customer_id,
          p_type: "admin_action",
          p_title: "Errand Cancelled",
          p_message: `Your errand "${errand.title}" has been cancelled by admin. Funds refunded.`,
          p_errand_id: errand_id,
        });

        if (errand.runner_id) {
          await supabase.rpc("create_notification", {
            p_user_id: errand.runner_id,
            p_type: "admin_action",
            p_title: "Errand Cancelled",
            p_message: `The errand "${errand.title}" has been cancelled by admin.`,
            p_errand_id: errand_id,
          });
        }

        result.message = "Errand cancelled and refunded";
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Admin action error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
