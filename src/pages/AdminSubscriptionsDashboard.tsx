import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Subscription {
  id: string;
  runner_id: string;
  status: string;
  started_at: string | null;
  trial_end_at: string | null;
  weekly_fee: number | null;
  last_billed_at: string | null;
  billing_attempts?: number | null;
  last_billing_error?: string | null;
  active: boolean;
}

export default function AdminSubscriptionsDashboard() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { full_name?: string | null; email: string }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data: subscriptions, error } = await supabase.from("runner_subscriptions").select("*");
      if (error) throw error;
      const subsData = subscriptions || [];
      setSubs(subsData as Subscription[]);

      const runnerIds = Array.from(new Set((subsData as any).map((s: any) => s.runner_id)));
      if (runnerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", runnerIds);
        const map: Record<string, any> = {};
        (profiles || []).forEach((p: any) => (map[p.id] = { full_name: p.full_name, email: p.email }));
        setProfilesMap(map);
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to fetch subscriptions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (id: string, updates: Partial<Subscription>) => {
    try {
      const { error } = await supabase.from("runner_subscriptions").update(updates).eq("id", id);
      if (error) throw error;
      toast({ title: "Updated", description: "Subscription updated" });
      fetchSubscriptions();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to update subscription", variant: "destructive" });
    }
  };

  const billNow = async () => {
    try {
      toast({ title: "Billing", description: "Triggering billing run..." });
      // Invoke the edge function (may require proper auth)
      const { data, error } = await supabase.functions.invoke("charge-runners");
      if (error) throw error;
      toast({ title: "Done", description: "Billing function invoked" });
      fetchSubscriptions();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to invoke billing", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Runner Subscriptions</h2>
        <div className="flex gap-2">
          <Button onClick={fetchSubscriptions} disabled={loading}>Refresh</Button>
          <Button onClick={billNow}>Run Billing Now</Button>
        </div>
      </div>

      <div className="space-y-3">
        {(subs || []).map((s) => (
          <div key={s.id} className="p-3 border rounded-md bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{profilesMap[s.runner_id]?.full_name || profilesMap[s.runner_id]?.email || s.runner_id}</div>
                <div className="text-sm text-muted-foreground">Runner ID: {s.runner_id}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{s.status}</div>
                <div className="text-sm">Active: {s.active ? "Yes" : "No"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div>Trial ends: {s.trial_end_at ? new Date(s.trial_end_at).toLocaleString() : "-"}</div>
              <div>Weekly fee: KES {s.weekly_fee?.toLocaleString() || "-"}</div>
              <div>Last billed: {s.last_billed_at ? new Date(s.last_billed_at).toLocaleString() : "-"}</div>
              <div>Attempts: {s.billing_attempts || 0}</div>
              <div className="col-span-2 text-sm text-muted-foreground">Last error: {s.last_billing_error || "None"}</div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button onClick={() => updateSubscription(s.id, { status: "active", active: true })}>Activate</Button>
              <Button onClick={() => updateSubscription(s.id, { status: "paused", active: false })}>Pause</Button>
              <Button onClick={() => updateSubscription(s.id, { status: "cancelled", active: false })} variant="destructive">Cancel</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
