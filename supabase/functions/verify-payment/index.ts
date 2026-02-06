import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Manual payment verification - checks IntaSend API and updates transaction immediately
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id, invoice_id } = await req.json();
    
    if (!transaction_id && !invoice_id) {
      throw new Error("transaction_id or invoice_id required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const intasendApiKey = Deno.env.get("INTASEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the transaction
    let tx;
    if (transaction_id) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transaction_id)
        .single();
      if (error) throw new Error(`Transaction not found: ${error.message}`);
      tx = data;
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("mpesa_reference", invoice_id)
        .single();
      if (error) throw new Error(`Transaction not found: ${error.message}`);
      tx = data;
    }

    console.log("Verifying transaction:", tx.id, "Invoice:", tx.mpesa_reference);

    // Already completed or failed - no need to check
    if (tx.status !== "pending") {
      return new Response(JSON.stringify({ 
        success: true,
        message: `Transaction already ${tx.status}`,
        transaction: tx
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoiceRef = tx.mpesa_reference || (tx.metadata as any)?.invoice?.invoice_id;
    if (!invoiceRef) {
      throw new Error("No invoice reference found");
    }

    // Check with IntaSend - POST request with invoice_id in body
    console.log("Checking IntaSend for invoice:", invoiceRef);
    const checkResponse = await fetch(
      `https://payment.intasend.com/api/v1/payment/status/`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${intasendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoice_id: invoiceRef }),
      }
    );

    console.log("IntaSend response status:", checkResponse.status);
    
    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.log("IntaSend error:", errorText);
      throw new Error(`IntaSend API error: ${checkResponse.status} - ${errorText}`);
    }

    const statusData = await checkResponse.json();
    console.log("IntaSend payment status:", JSON.stringify(statusData));

    // IntaSend returns state in invoice.state for collection status
    const state = statusData.invoice?.state || statusData.state || statusData.status;
    const mpesaReference = statusData.invoice?.mpesa_reference || statusData.mpesa_reference;
    const paymentValue = parseFloat(statusData.invoice?.value || statusData.value || tx.amount);
    
    let newStatus = tx.status;
    let message = "";

    if (state === "COMPLETE" || state === "SUCCESSFUL") {
      // Mark as completed and credit wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("id", tx.wallet_id)
        .single();

      if (wallet) {
        const finalMpesaRef = mpesaReference || invoiceRef;

        // Update transaction
        await supabase
          .from("transactions")
          .update({ 
            status: "completed",
            mpesa_reference: finalMpesaRef,
            metadata: {
              ...(tx.metadata || {}),
              payment_status: statusData,
              verified_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq("id", tx.id);

        // Credit wallet
        if (tx.type === "deposit") {
          await supabase
            .from("wallets")
            .update({ 
              balance: (parseFloat(wallet.balance as string) || 0) + paymentValue,
              updated_at: new Date().toISOString()
            })
            .eq("id", wallet.id);
        } else if (tx.type === "errand_payment") {
          await supabase
            .from("wallets")
            .update({ 
              escrow_balance: (parseFloat(wallet.escrow_balance as string) || 0) + paymentValue,
              updated_at: new Date().toISOString()
            })
            .eq("id", wallet.id);
        }

        newStatus = "completed";
        message = `Payment verified and wallet credited with KES ${paymentValue}`;
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
            verified_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", tx.id);

      newStatus = "failed";
      message = `Payment ${state.toLowerCase()}: ${statusData.failed_reason || 'No reason provided'}`;
    } else {
      message = `Payment still ${state} at IntaSend`;
    }

    return new Response(JSON.stringify({ 
      success: true,
      status: newStatus,
      intasend_state: state,
      message,
      payment_details: statusData
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
