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

    const { phone_number, amount } = await req.json();

    if (!phone_number || !amount) {
      return new Response(JSON.stringify({ error: "Phone number and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is KES 10" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wallet and check balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wallet.balance < amount) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create pending withdrawal transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        wallet_id: wallet.id,
        type: "withdrawal",
        amount,
        status: "pending",
        phone_number,
        description: "M-Pesa withdrawal",
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

    // Deduct from balance immediately (pending state)
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: wallet.balance - amount })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Failed to update balance:", updateError);
      // Rollback transaction
      await supabase.from("transactions").update({ status: "failed" }).eq("id", transaction.id);
      return new Response(JSON.stringify({ error: "Failed to process withdrawal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initiate IntaSend B2C transfer
    const intasendResponse = await fetch("https://payment.intasend.com/api/v1/send-money/mpesa/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${intasendApiKey}`,
      },
      body: JSON.stringify({
        phone_number: phone_number.replace(/^0/, "254"),
        amount: Math.floor(amount),
        narrative: "Tuma App Withdrawal",
      }),
    });

    const intasendData = await intasendResponse.json();
    console.log("IntaSend B2C response:", intasendData);

    if (!intasendResponse.ok) {
      // Refund balance and mark transaction failed
      await supabase
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("id", wallet.id);
      
      await supabase
        .from("transactions")
        .update({ status: "failed", metadata: intasendData })
        .eq("id", transaction.id);

      return new Response(JSON.stringify({ 
        error: intasendData.message || "Withdrawal failed" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark transaction as completed
    await supabase
      .from("transactions")
      .update({ 
        status: "completed",
        mpesa_reference: intasendData.tracking_id || intasendData.id,
        metadata: intasendData 
      })
      .eq("id", transaction.id);

    return new Response(JSON.stringify({ 
      success: true,
      transaction_id: transaction.id,
      message: `KES ${amount} sent to ${phone_number}`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
