import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function checks and resolves stale pending transactions
// It should be called periodically (e.g., via cron) or manually by admin

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const intasendApiKey = Deno.env.get("INTASEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find pending transactions older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo)
      .in("type", ["deposit", "errand_payment"]);

    if (fetchError) {
      throw new Error(`Failed to fetch pending transactions: ${fetchError.message}`);
    }

    console.log(`Found ${pendingTransactions?.length || 0} stale pending transactions`);

    const results: Array<{ id: string; status: string; action: string }> = [];

    for (const tx of pendingTransactions || []) {
      const invoiceId = tx.mpesa_reference || (tx.metadata as any)?.invoice?.invoice_id || (tx.metadata as any)?.id;
      
      if (!invoiceId) {
        // No invoice ID - mark as failed (STK push likely never initiated properly)
        await supabase
          .from("transactions")
          .update({ 
            status: "failed",
            metadata: {
              ...(tx.metadata || {}),
              failure_reason: "No payment reference - STK push may have failed",
              auto_resolved_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq("id", tx.id);

        results.push({ id: tx.id, status: "failed", action: "No invoice ID" });
        continue;
      }

      // Check payment status with IntaSend
      try {
        const checkResponse = await fetch(
          `https://payment.intasend.com/api/v1/payment/status/${invoiceId}/`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${intasendApiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!checkResponse.ok) {
          console.log(`Failed to check status for ${tx.id}: ${checkResponse.status}`);
          
          // If invoice not found or error, mark as failed after 10 minutes
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          if (tx.created_at < tenMinutesAgo) {
            await supabase
              .from("transactions")
              .update({ 
                status: "failed",
                metadata: {
                  ...(tx.metadata || {}),
                  failure_reason: "Payment verification failed - transaction expired",
                  auto_resolved_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
              })
              .eq("id", tx.id);

            results.push({ id: tx.id, status: "failed", action: "Expired" });
          }
          continue;
        }

        const statusData = await checkResponse.json();
        console.log(`Status for ${tx.id}:`, statusData);

        const state = statusData.state || statusData.status;

        if (state === "COMPLETE" || state === "SUCCESSFUL") {
          // Process as successful payment
          const { data: wallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("id", tx.wallet_id)
            .single();

          if (wallet) {
            const amount = parseFloat(statusData.value || tx.amount);

            await supabase
              .from("transactions")
              .update({ 
                status: "completed",
                mpesa_reference: statusData.mpesa_reference || invoiceId,
                metadata: {
                  ...(tx.metadata || {}),
                  payment_status: statusData,
                  auto_resolved_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
              })
              .eq("id", tx.id);

            if (tx.type === "deposit") {
              await supabase
                .from("wallets")
                .update({ 
                  balance: (parseFloat(wallet.balance as string) || 0) + amount,
                  updated_at: new Date().toISOString()
                })
                .eq("id", wallet.id);
            } else if (tx.type === "errand_payment") {
              await supabase
                .from("wallets")
                .update({ 
                  escrow_balance: (parseFloat(wallet.escrow_balance as string) || 0) + amount,
                  updated_at: new Date().toISOString()
                })
                .eq("id", wallet.id);
            }

            results.push({ id: tx.id, status: "completed", action: "Auto-resolved" });
          }

        } else if (state === "FAILED" || state === "CANCELLED" || state === "EXPIRED") {
          await supabase
            .from("transactions")
            .update({ 
              status: "failed",
              metadata: {
                ...(tx.metadata || {}),
                payment_status: statusData,
                failure_reason: statusData.failed_reason || `Payment ${state.toLowerCase()}`,
                auto_resolved_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq("id", tx.id);

          results.push({ id: tx.id, status: "failed", action: state });
        } else {
          // Still pending - check if too old
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          if (tx.created_at < fifteenMinutesAgo) {
            await supabase
              .from("transactions")
              .update({ 
                status: "failed",
                metadata: {
                  ...(tx.metadata || {}),
                  payment_status: statusData,
                  failure_reason: "Transaction timed out",
                  auto_resolved_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
              })
              .eq("id", tx.id);

            results.push({ id: tx.id, status: "failed", action: "Timeout" });
          } else {
            results.push({ id: tx.id, status: "pending", action: "Still waiting" });
          }
        }

      } catch (checkError) {
        console.error(`Error checking status for ${tx.id}:`, checkError);
        results.push({ id: tx.id, status: "pending", action: "Check failed" });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: results.length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Check pending transactions error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
