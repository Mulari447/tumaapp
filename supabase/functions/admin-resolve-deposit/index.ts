import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ResolveAction = "complete" | "fail";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Role lookup error:", roleError);
      return new Response(JSON.stringify({ error: "Authorization check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (roleRow?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const transaction_id = body?.transaction_id as string | undefined;
    const action = body?.action as ResolveAction | undefined;
    const manual_reference = body?.manual_reference as string | undefined;
    const note = body?.note as string | undefined;

    if (!transaction_id || (action !== "complete" && action !== "fail")) {
      return new Response(JSON.stringify({ error: "transaction_id and valid action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txFetchError } = await supabase
      .from("transactions")
      .select("id, type, status, amount, wallet_id, mpesa_reference, metadata")
      .eq("id", transaction_id)
      .single();

    if (txFetchError || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.type !== "deposit") {
      return new Response(JSON.stringify({ error: "Only deposit transactions can be resolved here" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if already in final state, return success
    if (tx.status === "completed" && action === "complete") {
      return new Response(JSON.stringify({ success: true, status: "completed", already_resolved: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((tx.status === "failed" || tx.status === "cancelled") && action === "fail") {
      return new Response(JSON.stringify({ success: true, status: tx.status, already_resolved: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Only pending transactions can be resolved (current: ${tx.status})`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    const reference = (manual_reference || tx.mpesa_reference || "").trim() || null;

    // Duplicate reference protection (only for successful resolution)
    if (action === "complete" && reference) {
      const { data: existingTx, error: dupError } = await supabase
        .from("transactions")
        .select("id")
        .eq("mpesa_reference", reference)
        .eq("status", "completed")
        .neq("id", tx.id)
        .maybeSingle();

      if (dupError) {
        console.error("Duplicate check error:", dupError);
        return new Response(JSON.stringify({ error: "Duplicate check failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingTx) {
        return new Response(
          JSON.stringify({ error: "Duplicate payment reference detected" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const mergedMeta = {
      ...(typeof tx.metadata === "object" && tx.metadata ? (tx.metadata as Record<string, unknown>) : {}),
      resolved_by_admin: true,
      admin_resolution_note: note || null,
      admin_resolved_at: now,
      ...(action === "complete"
        ? { processed_at: now, credited_amount: Number(tx.amount) }
        : {
            failed_at: now,
            failure_reason: note || "Manually marked as failed by admin",
          }),
    };

    const newStatus = action === "complete" ? "completed" : "failed";

    // Update transaction (guarded by status=pending to prevent double-credit)
    const { data: updatedTx, error: updateError } = await supabase
      .from("transactions")
      .update({
        status: newStatus,
        mpesa_reference: reference,
        metadata: mergedMeta,
        updated_at: now,
      })
      .eq("id", tx.id)
      .eq("status", "pending")
      .select("id, status, wallet_id, amount")
      .maybeSingle();

    if (updateError) {
      console.error("Transaction update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update transaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updatedTx) {
      // Someone else resolved it between fetch and update
      return new Response(JSON.stringify({ success: true, status: "already_resolved" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit wallet only on successful completion
    if (action === "complete") {
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("id", updatedTx.wallet_id)
        .single();

      if (walletError || !wallet) {
        console.error("Wallet fetch error:", walletError);
        return new Response(JSON.stringify({ error: "Failed to fetch wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newBalance = (parseFloat(wallet.balance as unknown as string) || 0) + Number(updatedTx.amount);
      const { error: walletUpdateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance, updated_at: now })
        .eq("id", wallet.id);

      if (walletUpdateError) {
        console.error("Wallet update error:", walletUpdateError);
        return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Admin resolve deposit error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
