import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSubscriptions() {
  const { user } = useAuth();
  const [emailOrId, setEmailOrId] = useState("");
  const [weeklyFee, setWeeklyFee] = useState(300);
  const [creating, setCreating] = useState(false);

  const createSubscription = async () => {
    if (!user) {
      toast({ title: "Unauthorized", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      let runnerId = emailOrId;
      if (emailOrId.includes("@")) {
        const { data: profiles } = await supabase.from("profiles").select("id").eq("email", emailOrId).limit(1).single();
        if (!profiles) throw new Error("Runner not found");
        runnerId = (profiles as any).id;
      }

      const { error } = await (supabase as any).from("runner_subscriptions").insert({
        runner_id: runnerId,
        status: "trial",
        weekly_fee: weeklyFee,
        trial_end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        started_at: new Date().toISOString(),
        active: true,
      });

      if (error) throw error;

      toast({ title: "Subscription Created", description: "Runner subscription created (trial week)." });
      setEmailOrId("");
      setWeeklyFee(300);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to create subscription.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Runner Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Runner Email or ID</label>
              <Input value={emailOrId} onChange={(e) => setEmailOrId(e.target.value)} placeholder="runner@example.com or runner-id" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Weekly Fee (KES)</label>
              <Input type="number" value={weeklyFee} onChange={(e) => setWeeklyFee(Number(e.target.value))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createSubscription} disabled={creating}>Create Subscription</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
