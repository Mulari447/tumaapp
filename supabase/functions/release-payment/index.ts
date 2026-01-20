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

    const { errand_id } = await req.json();

    if (!errand_id) {
      return new Response(JSON.stringify({ error: "Errand ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get errand details
    const { data: errand, error: errandError } = await supabase
      .from("errands")
      .select("*")
      .eq("id", errand_id)
      .single();

    if (errandError || !errand) {
      return new Response(JSON.stringify({ error: "Errand not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only customer who posted can release payment
    if (errand.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the customer can release payment" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (errand.status !== "in_progress" && errand.status !== "assigned") {
      return new Response(JSON.stringify({ error: "Errand must be in progress to release payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!errand.runner_id) {
      return new Response(JSON.stringify({ error: "No runner assigned to this errand" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get customer wallet
    const { data: customerWallet, error: cwError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", errand.customer_id)
      .single();

    if (cwError || !customerWallet) {
      return new Response(JSON.stringify({ error: "Customer wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get runner wallet
    const { data: runnerWallet, error: rwError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", errand.runner_id)
      .single();

    if (rwError || !runnerWallet) {
      return new Response(JSON.stringify({ error: "Runner wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = parseFloat(errand.budget);
    const commission = totalAmount * PLATFORM_COMMISSION;
    const runnerAmount = totalAmount - commission;

    // Check escrow balance
    if (parseFloat(customerWallet.escrow_balance) < totalAmount) {
      return new Response(JSON.stringify({ error: "Insufficient escrow balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from customer escrow
    await supabase
      .from("wallets")
      .update({ 
        escrow_balance: parseFloat(customerWallet.escrow_balance) - totalAmount 
      })
      .eq("id", customerWallet.id);

    // Add to runner balance
    await supabase
      .from("wallets")
      .update({ 
        balance: parseFloat(runnerWallet.balance) + runnerAmount 
      })
      .eq("id", runnerWallet.id);

    // Create release transaction for customer
    await supabase
      .from("transactions")
      .insert({
        wallet_id: customerWallet.id,
        errand_id,
        type: "errand_release",
        amount: totalAmount,
        status: "completed",
        description: `Payment released for errand`,
      });

    // Create earning transaction for runner
    await supabase
      .from("transactions")
      .insert({
        wallet_id: runnerWallet.id,
        errand_id,
        type: "errand_release",
        amount: runnerAmount,
        status: "completed",
        description: `Earned from errand (${PLATFORM_COMMISSION * 100}% commission deducted)`,
      });

    // Create commission transaction (for platform records)
    await supabase
      .from("transactions")
      .insert({
        wallet_id: customerWallet.id,
        errand_id,
        type: "commission",
        amount: commission,
        status: "completed",
        description: `Platform commission`,
      });

    // Mark errand as completed
    await supabase
      .from("errands")
      .update({ status: "completed" })
      .eq("id", errand_id);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Payment of KES ${runnerAmount} released to runner`,
      commission: commission,
      runner_amount: runnerAmount
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Release payment error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
