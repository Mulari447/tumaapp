import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_COMMISSION = 0.15;
const BASE_RATE = 150;
const HOURLY_RATE = 150;

// Valid status transitions
const validTransitions: Record<string, string[]> = {
  open: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled", "open"], // can be released back
  in_progress: ["completed", "cancelled"],
  completed: ["confirmed", "disputed"],
  confirmed: ["paid"],
  disputed: ["confirmed", "cancelled", "open"], // admin can resolve
  paid: [],
  cancelled: [],
};

interface StatusUpdateRequest {
  errand_id: string;
  new_status: string;
  notes?: string;
  dispute_reason?: string;
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

    const { errand_id, new_status, notes, dispute_reason }: StatusUpdateRequest = await req.json();

    if (!errand_id || !new_status) {
      return new Response(JSON.stringify({ error: "errand_id and new_status are required" }), {
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

    // Check if user is admin
    const { data: isAdminResult } = await supabase.rpc("is_admin");
    const isAdmin = isAdminResult === true;

    // Check if transition is valid
    const currentStatus = errand.status;
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(new_status) && !isAdmin) {
      return new Response(JSON.stringify({ 
        error: `Cannot transition from ${currentStatus} to ${new_status}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization checks based on status transition
    const isCustomer = errand.customer_id === user.id;
    const isRunner = errand.runner_id === user.id;

    // Allow any verified runner to accept an open errand
    if (new_status === "assigned" && currentStatus === "open") {
      // Verify the user is a verified runner
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, verification_status")
        .eq("id", user.id)
        .single();

      if (!profile || profile.user_type !== "runner" || profile.verification_status !== "verified") {
        return new Response(JSON.stringify({ error: "Only verified runners can accept errands" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Allowed - skip further auth checks for this transition
    }
    // Runner actions: assigned -> in_progress, in_progress -> completed
    else if ((new_status === "in_progress" || new_status === "completed") && !isRunner && !isAdmin) {
      return new Response(JSON.stringify({ error: "Only the assigned runner can update to this status" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Customer actions: completed -> confirmed, completed -> disputed
    if ((new_status === "confirmed" || new_status === "disputed") && !isCustomer && !isAdmin) {
      return new Response(JSON.stringify({ error: "Only the customer can confirm or dispute" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status: new_status,
    };

    // Set runner_id when accepting an errand
    if (new_status === "assigned" && currentStatus === "open") {
      updateData.runner_id = user.id;
    }

    // Add timestamp for the new status
    const now = new Date().toISOString();
    switch (new_status) {
      case "assigned":
        updateData.accepted_at = now;
        break;
      case "in_progress":
        updateData.started_at = now;
        break;
      case "completed":
        updateData.completed_at = now;
        break;
      case "confirmed":
        updateData.confirmed_at = now;
        break;
      case "disputed":
        updateData.disputed_at = now;
        updateData.dispute_reason = dispute_reason || "Issue raised by customer";
        break;
      case "paid":
        updateData.paid_at = now;
        break;
    }

    if (notes && isAdmin) {
      updateData.admin_notes = notes;
    }

    // Update errand
    const { error: updateError } = await supabase
      .from("errands")
      .update(updateData)
      .eq("id", errand_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update errand" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log status change
    await supabase.rpc("log_status_change", {
      p_errand_id: errand_id,
      p_previous_status: currentStatus,
      p_new_status: new_status,
      p_changed_by: user.id,
      p_notes: notes || null,
    });

    // Create notifications based on status change
    const notifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
    }> = [];

    switch (new_status) {
      case "assigned":
        notifications.push({
          user_id: errand.customer_id,
          type: "job_accepted",
          title: "Runner Accepted Your Errand",
          message: `A runner has accepted your errand "${errand.title}"`,
        });
        break;
      case "in_progress":
        notifications.push({
          user_id: errand.customer_id,
          type: "job_started",
          title: "Errand In Progress",
          message: `The runner has started working on "${errand.title}"`,
        });
        break;
      case "completed":
        notifications.push({
          user_id: errand.customer_id,
          type: "confirmation_requested",
          title: "Please Confirm Completion",
          message: `The runner has marked "${errand.title}" as completed. Please confirm.`,
        });
        break;
      case "confirmed":
        notifications.push({
          user_id: errand.runner_id,
          type: "job_confirmed",
          title: "Errand Confirmed!",
          message: `The customer confirmed completion of "${errand.title}". Payment will be released.`,
        });
        break;
      case "disputed":
        // Notify runner
        if (errand.runner_id) {
          notifications.push({
            user_id: errand.runner_id,
            type: "job_disputed",
            title: "Issue Raised",
            message: `The customer raised an issue with "${errand.title}"`,
          });
        }
        // Notify admins
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins) {
          for (const admin of admins) {
            notifications.push({
              user_id: admin.user_id,
              type: "job_disputed",
              title: "Dispute Requires Attention",
              message: `A dispute was raised for errand "${errand.title}"`,
            });
          }
        }
        break;
    }

    // Insert notifications
    for (const notif of notifications) {
      await supabase.rpc("create_notification", {
        p_user_id: notif.user_id,
        p_type: notif.type,
        p_title: notif.title,
        p_message: notif.message,
        p_errand_id: errand_id,
      });
    }

    // Refund posting fee when errand is cancelled or unassigned (assigned -> open)
    if (new_status === "cancelled" || (new_status === "open" && currentStatus === "assigned")) {
      try {
        const { data: customerWallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", errand.customer_id)
          .single();

        if (customerWallet) {
          // Find the original errand posting payment (errand_payment)
          const { data: feeTx } = await supabase
            .from("transactions")
            .select("*")
            .eq("errand_id", errand_id)
            .eq("type", "errand_payment")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (feeTx && feeTx.amount && feeTx.status === "completed") {
            const refundAmount = parseFloat(String(feeTx.amount)) || 0;
            if (refundAmount > 0) {
              // Check for existing refund to avoid double refunds
              const { data: existingRefunds } = await supabase
                .from("transactions")
                .select("id")
                .eq("errand_id", errand_id)
                .eq("type", "refund")
                .limit(1);

              if (!existingRefunds || existingRefunds.length === 0) {
                // Create refund transaction
                await supabase.from("transactions").insert({
                  wallet_id: customerWallet.id,
                  errand_id,
                  type: "refund",
                  amount: refundAmount,
                  status: "completed",
                  description: `Refund for errand posting fee (${new_status})`,
                });

                // Credit customer wallet balance
                await supabase
                  .from("wallets")
                  .update({ balance: parseFloat(customerWallet.balance) + refundAmount })
                  .eq("id", customerWallet.id);

                // Notify customer about refund
                await supabase.rpc("create_notification", {
                  p_user_id: errand.customer_id,
                  p_type: "job_reassigned",
                  p_title: "Posting Fee Refunded",
                  p_message: `KES ${refundAmount.toFixed(2)} has been refunded for your errand "${errand.title}"`,
                  p_errand_id: errand_id,
                });
              } else {
                console.log("Refund already exists for errand", errand_id);
              }
            }
          }
        }
      } catch (refundErr) {
        console.error("Refund error:", refundErr);
      }
    }

    // If confirmed, release payment
    if (new_status === "confirmed" && errand.runner_id) {
      // Get wallets
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
        const commission = totalAmount * PLATFORM_COMMISSION;
        const runnerAmount = totalAmount - commission;

        // Check escrow balance
        if (parseFloat(customerWallet.escrow_balance) >= totalAmount) {
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

          // Create transactions
          await supabase.from("transactions").insert([
            {
              wallet_id: customerWallet.id,
              errand_id,
              type: "errand_release",
              amount: totalAmount,
              status: "completed",
              description: `Payment released for errand`,
            },
            {
              wallet_id: runnerWallet.id,
              errand_id,
              type: "errand_release",
              amount: runnerAmount,
              status: "completed",
              description: `Earned from errand (${PLATFORM_COMMISSION * 100}% commission deducted)`,
            },
            {
              wallet_id: customerWallet.id,
              errand_id,
              type: "commission",
              amount: commission,
              status: "completed",
              description: `Platform commission`,
            },
          ]);

          // Update errand to paid
          await supabase
            .from("errands")
            .update({ status: "paid", paid_at: now })
            .eq("id", errand_id);

          // Notify runner of payment
          await supabase.rpc("create_notification", {
            p_user_id: errand.runner_id,
            p_type: "job_paid",
            p_title: "Payment Received!",
            p_message: `KES ${runnerAmount.toFixed(2)} has been added to your wallet for "${errand.title}"`,
            p_errand_id: errand_id,
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Errand status updated to ${new_status}`,
      previous_status: currentStatus,
      new_status,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Update status error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
