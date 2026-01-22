import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("M-Pesa callback payload:", JSON.stringify(payload));

    const { 
      api_ref, 
      state, 
      value,
      invoice_id,
      mpesa_reference,
      failed_reason,
      failed_code 
    } = payload;

    if (!api_ref) {
      console.log("No api_ref in callback");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find transaction by our reference
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, wallets(*)")
      .eq("id", api_ref)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found:", api_ref);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY CHECK: Don't process if already completed or failed
    if (transaction.status === "completed" || transaction.status === "failed") {
      console.log(`Transaction ${api_ref} already processed with status: ${transaction.status}. Skipping.`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: "Already processed" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate mpesa_reference to prevent double-credit
    if (mpesa_reference) {
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("mpesa_reference", mpesa_reference)
        .eq("status", "completed")
        .neq("id", transaction.id)
        .single();

      if (existingTx) {
        console.log(`Duplicate M-Pesa reference detected: ${mpesa_reference}. Skipping.`);
        await supabase
          .from("transactions")
          .update({ 
            status: "failed",
            metadata: { ...payload, failure_reason: "Duplicate transaction detected" } 
          })
          .eq("id", transaction.id);

        return new Response(JSON.stringify({ 
          received: true, 
          message: "Duplicate detected" 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isSuccess = state === "COMPLETE" || state === "SUCCESSFUL";
    const isFailed = state === "FAILED" || state === "CANCELLED" || state === "EXPIRED";
    const now = new Date().toISOString();

    if (isSuccess) {
      const amount = parseFloat(value || transaction.amount);

      // Update transaction as completed with timestamp
      await supabase
        .from("transactions")
        .update({ 
          status: "completed",
          mpesa_reference: mpesa_reference || invoice_id,
          metadata: {
            ...payload,
            processed_at: now,
            credited_amount: amount
          },
          updated_at: now
        })
        .eq("id", transaction.id);

      if (transaction.type === "errand_payment" && transaction.errand_id) {
        // Add to escrow balance
        const newEscrowBalance = (parseFloat(transaction.wallets.escrow_balance) || 0) + amount;
        
        await supabase
          .from("wallets")
          .update({ 
            escrow_balance: newEscrowBalance,
            updated_at: now
          })
          .eq("id", transaction.wallet_id);

        // Update errand status to assigned if it was open
        await supabase
          .from("errands")
          .update({ status: "assigned" })
          .eq("id", transaction.errand_id)
          .eq("status", "open");

        console.log(`Escrow payment successful: ${transaction.id}, amount: ${amount}, new escrow: ${newEscrowBalance}`);

      } else if (transaction.type === "deposit") {
        // Add to available balance
        const newBalance = (parseFloat(transaction.wallets.balance) || 0) + amount;
        
        await supabase
          .from("wallets")
          .update({ 
            balance: newBalance,
            updated_at: now
          })
          .eq("id", transaction.wallet_id);

        console.log(`Deposit successful: ${transaction.id}, amount: ${amount}, new balance: ${newBalance}`);
      }

      // Create notification for successful deposit
      const { data: wallet } = await supabase
        .from("wallets")
        .select("user_id")
        .eq("id", transaction.wallet_id)
        .single();

      if (wallet) {
        await supabase.rpc("create_notification", {
          p_user_id: wallet.user_id,
          p_type: "job_paid",
          p_title: "Deposit Successful",
          p_message: `KES ${amount.toLocaleString()} has been added to your wallet. Ref: ${mpesa_reference || invoice_id}`,
        });
      }

    } else if (isFailed) {
      // Build failure reason message
      const failureReason = failed_reason || 
        (state === "CANCELLED" ? "Transaction cancelled by user" : 
         state === "EXPIRED" ? "Transaction timed out" : 
         "Payment failed");

      await supabase
        .from("transactions")
        .update({ 
          status: "failed",
          metadata: {
            ...payload,
            failure_reason: failureReason,
            failure_code: failed_code,
            failed_at: now
          },
          updated_at: now
        })
        .eq("id", transaction.id);

      console.log(`Payment failed: ${transaction.id}, reason: ${failureReason}`);

      // Create notification for failed deposit
      const { data: wallet } = await supabase
        .from("wallets")
        .select("user_id")
        .eq("id", transaction.wallet_id)
        .single();

      if (wallet) {
        await supabase.rpc("create_notification", {
          p_user_id: wallet.user_id,
          p_type: "admin_action",
          p_title: "Payment Failed",
          p_message: `Your deposit of KES ${transaction.amount.toLocaleString()} failed: ${failureReason}`,
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
