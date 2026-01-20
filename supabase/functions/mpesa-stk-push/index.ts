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
    const intasendApiKey = Deno.env.get("INTASEND_API_KEY")!;
    const intasendPublishableKey = Deno.env.get("INTASEND_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone_number, amount, errand_id, description } = await req.json();

    if (!phone_number || !amount) {
      return new Response(JSON.stringify({ error: "Phone number and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create wallet
    let { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from("wallets")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      
      if (createError) {
        console.error("Failed to create wallet:", createError);
        return new Response(JSON.stringify({ error: "Failed to create wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      wallet = newWallet;
    }

    // Create pending transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        wallet_id: wallet.id,
        errand_id: errand_id || null,
        type: errand_id ? "errand_payment" : "deposit",
        amount,
        status: "pending",
        phone_number,
        description: description || (errand_id ? "Errand payment" : "Wallet deposit"),
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Failed to create transaction:", txError);
      return new Response(JSON.stringify({ error: "Failed to create transaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initiate IntaSend STK Push
    const intasendResponse = await fetch("https://payment.intasend.com/api/v1/payment/mpesa-stk-push/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${intasendApiKey}`,
        "X-IntaSend-Public-API-Key": intasendPublishableKey,
      },
      body: JSON.stringify({
        phone_number: phone_number.replace(/^0/, "254"),
        amount: Math.ceil(amount),
        api_ref: transaction.id,
        narrative: description || "Tuma App Payment",
      }),
    });

    const intasendData = await intasendResponse.json();
    console.log("IntaSend response:", intasendData);

    if (!intasendResponse.ok) {
      // Mark transaction as failed
      await supabase
        .from("transactions")
        .update({ status: "failed", metadata: intasendData })
        .eq("id", transaction.id);

      return new Response(JSON.stringify({ 
        error: intasendData.message || "Payment initiation failed" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update transaction with IntaSend reference
    await supabase
      .from("transactions")
      .update({ 
        mpesa_reference: intasendData.invoice?.invoice_id || intasendData.id,
        metadata: intasendData 
      })
      .eq("id", transaction.id);

    return new Response(JSON.stringify({ 
      success: true,
      transaction_id: transaction.id,
      checkout_id: intasendData.id,
      message: "STK push sent to your phone"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("STK Push error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
