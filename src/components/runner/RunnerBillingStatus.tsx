import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RunnerSubscription {
  id: string;
  runner_id: string;
  status: "trial" | "active" | "paused" | "cancelled";
  started_at: string;
  trial_end_at: string;
  weekly_fee: number;
  last_billed_at: string | null;
  next_billing_at: string | null;
  active: boolean;
  billing_activated: boolean;
  first_gig_completed_at: string | null;
  gigs_completed: number;
  created_at: string;
}

export function RunnerBillingStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<RunnerSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchSubscription();

    const channel = supabase
      .channel(`runner_subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "runner_subscriptions",
          filter: `runner_id=eq.${user.id}`,
        },
        (payload) => {
          setSubscription(payload.new as RunnerSubscription);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from("runner_subscriptions")
        .select("*")
        .eq("runner_id", user.id)
        .single();

      if (!error && data) {
        setSubscription(data as RunnerSubscription);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscription) {
    return null;
  }

  const now = new Date();
  const trialEndDate = new Date(subscription.trial_end_at);
  const isTrialActive = subscription.status === "trial" && now < trialEndDate;
  const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">Subscription Status</span>
              <Badge variant={getStatusVariant(subscription.status)}>
                {getStatusLabel(subscription.status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Weekly subscription: KES {subscription.weekly_fee}/week
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTrialActive && !subscription.billing_activated && (
          <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <p className="font-semibold">Free Trial Active</p>
              <p className="text-sm mt-1">
                Your first week is free! Trial ends in {daysRemaining} days.
                Complete at least 1 gig to activate billing.
              </p>
              <p className="text-sm mt-2">
                Gigs completed during trial: <span className="font-bold">{subscription.gigs_completed}</span>
              </p>
            </AlertDescription>
          </Alert>
        )}

        {subscription.status === "trial" && subscription.billing_activated && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <p className="font-semibold">Trial Ending Soon</p>
              <p className="text-sm mt-1">
                Billing will start when your trial ends. You'll be charged KES {subscription.weekly_fee} weekly.
              </p>
              <p className="text-sm mt-2">
                Trial ends: {formatDistanceToNow(trialEndDate, { addSuffix: true })}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {subscription.status === "active" && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <p className="font-semibold">Billing Active</p>
              <p className="text-sm mt-1">
                You're being charged KES {subscription.weekly_fee} weekly.
              </p>
              {subscription.next_billing_at && (
                <p className="text-sm mt-2">
                  Next billing: {formatDistanceToNow(new Date(subscription.next_billing_at), { addSuffix: true })}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {subscription.status === "paused" && (
          <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <p className="font-semibold">Billing Paused</p>
              <p className="text-sm mt-1">
                Complete at least 1 gig to activate billing.
              </p>
              <p className="text-sm mt-2">
                Gigs completed: <span className="font-bold">{subscription.gigs_completed}</span>
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-sm text-muted-foreground">Gigs Completed</p>
            <p className="text-2xl font-bold">{subscription.gigs_completed}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Weekly Fee</p>
            <p className="text-2xl font-bold">KES {subscription.weekly_fee}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "trial": return "secondary";
    case "active": return "default";
    case "paused": return "destructive";
    case "cancelled": return "destructive";
    default: return "outline";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "trial": return "Free Trial";
    case "active": return "Active";
    case "paused": return "Paused";
    case "cancelled": return "Cancelled";
    default: return "Unknown";
  }
}
