import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RunnerStats } from "@/components/admin/RunnerStats";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import { ArrowLeft, LogOut, RefreshCw, Shield } from "lucide-react";

type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";
type FilterStatus = "all" | VerificationStatus;

interface Runner {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  verification_status: VerificationStatus | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  pending: number;
  underReview: number;
  verified: number;
  rejected: number;
}

export default function AdminDashboard() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { signOut } = useAuth();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    underReview: 0,
    verified: 0,
    rejected: 0,
  });
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);

  const fetchRunners = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, email, full_name, phone, verification_status, created_at, updated_at")
        .eq("user_type", "runner")
        .order("updated_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("verification_status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRunners((data as Runner[]) || []);
    } catch (error) {
      console.error("Error fetching runners:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("user_type", "runner");

      if (error) throw error;

      const newStats: Stats = {
        total: data?.length || 0,
        pending: 0,
        underReview: 0,
        verified: 0,
        rejected: 0,
      };

      data?.forEach((runner) => {
        switch (runner.verification_status) {
          case "pending":
            newStats.pending++;
            break;
          case "under_review":
            newStats.underReview++;
            break;
          case "verified":
            newStats.verified++;
            break;
          case "rejected":
            newStats.rejected++;
            break;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchRunners();
    }
  }, [isAdmin, filter]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Runner Verification Overview</h2>
          <RunnerStats stats={stats} />
        </section>

        {/* Verification Queue */}
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Verification Queue</CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={filter}
                  onValueChange={(value) => setFilter(value as FilterStatus)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Runners</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    fetchStats();
                    fetchRunners();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <VerificationQueue runners={runners} loading={loading} />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
