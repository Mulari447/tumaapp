import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_COMMISSION = 0.15; // 15% commission

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
      mpesa_reference 
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

    const isSuccess = state === "COMPLETE" || state === "SUCCESSFUL";
    const isFailed = state === "FAILED" || state === "CANCELLED";

    if (isSuccess) {
      // Update transaction as completed
      await supabase
        .from("transactions")
        .update({ 
          status: "completed",
          mpesa_reference: mpesa_reference || invoice_id,
          metadata: payload 
        })
        .eq("id", transaction.id);

      const amount = parseFloat(value || transaction.amount);

      if (transaction.type === "errand_payment" && transaction.errand_id) {
        // Add to escrow balance
        await supabase
          .from("wallets")
          .update({ 
            escrow_balance: (parseFloat(transaction.wallets.escrow_balance) || 0) + amount 
          })
          .eq("id", transaction.wallet_id);

        // Update errand status to assigned if it was open
        await supabase
          .from("errands")
          .update({ status: "assigned" })
          .eq("id", transaction.errand_id)
          .eq("status", "open");

      } else if (transaction.type === "deposit") {
        // Add to available balance
        await supabase
          .from("wallets")
          .update({ 
            balance: (parseFloat(transaction.wallets.balance) || 0) + amount 
          })
          .eq("id", transaction.wallet_id);
      }

      console.log(`Payment successful: ${transaction.id}, amount: ${amount}`);

    } else if (isFailed) {
      await supabase
        .from("transactions")
        .update({ 
          status: "failed",
          metadata: payload 
        })
        .eq("id", transaction.id);

      console.log(`Payment failed: ${transaction.id}`);
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
