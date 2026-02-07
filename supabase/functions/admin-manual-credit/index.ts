import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // First verify the user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth to verify admin status
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdminData } = await userClient.rpc("is_admin");
    if (!isAdminData) {
      console.error("User is not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_email, amount, mpesa_confirmation_code, note } = await req.json();

    // Validate input
    if (!user_email || !amount || !mpesa_confirmation_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_email, amount, mpesa_confirmation_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate M-Pesa confirmation code format (typically alphanumeric, 10 chars)
    const mpesaCode = mpesa_confirmation_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,12}$/.test(mpesaCode)) {
      return new Response(
        JSON.stringify({ error: "Invalid M-Pesa confirmation code format. Should be 8-12 alphanumeric characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this M-Pesa code was already used
    const { data: existingTx } = await adminClient
      .from("transactions")
      .select("id, status")
      .eq("mpesa_reference", mpesaCode)
      .single();

    if (existingTx) {
      return new Response(
        JSON.stringify({ 
          error: `M-Pesa code ${mpesaCode} already exists in the system with status: ${existingTx.status}`,
          existing_transaction_id: existingTx.id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", user_email.trim().toLowerCase())
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: `User not found with email: ${user_email}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await adminClient
      .from("wallets")
      .select("id, balance")
      .eq("user_id", profile.id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found:", walletError);
      return new Response(
        JSON.stringify({ error: "User wallet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${user.id} manually crediting wallet ${wallet.id} with ${numAmount} KES`);

    // Create the transaction record
    const { data: transaction, error: txError } = await adminClient
      .from("transactions")
      .insert({
        wallet_id: wallet.id,
        type: "deposit",
        amount: numAmount,
        status: "completed",
        mpesa_reference: mpesaCode,
        description: "Manual credit by admin",
        metadata: {
          manual_credit: true,
          credited_by_admin: user.id,
          admin_note: note || null,
          credited_at: new Date().toISOString(),
          user_email: profile.email,
          user_name: profile.full_name,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error("Error creating transaction:", txError);
      return new Response(
        JSON.stringify({ error: "Failed to create transaction record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update wallet balance
    const newBalance = Number(wallet.balance) + numAmount;
    const { error: updateError } = await adminClient
      .from("wallets")
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Error updating wallet balance:", updateError);
      // Rollback: mark transaction as failed
      await adminClient
        .from("transactions")
        .update({ 
          status: "failed",
          metadata: {
            ...transaction.metadata,
            failure_reason: "Failed to update wallet balance"
          }
        })
        .eq("id", transaction.id);

      return new Response(
        JSON.stringify({ error: "Failed to update wallet balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully credited ${numAmount} KES to ${profile.email}. New balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully credited KES ${numAmount.toLocaleString()} to ${profile.email}`,
        transaction_id: transaction.id,
        new_balance: newBalance,
        user: {
          email: profile.email,
          name: profile.full_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Manual credit error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
