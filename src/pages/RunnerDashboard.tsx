import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Loader2,
  MapPin,
  Play,
  Flag,
  MessageSquare,
  ChevronDown,
  Wallet,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrandMessages } from "@/components/errands/ErrandMessages";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ErrandStatus = "open" | "assigned" | "in_progress" | "completed" | "confirmed" | "disputed" | "paid" | "cancelled";

interface Errand {
  id: string;
  title: string;
  description: string;
  category: string;
  customer_id: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  location: string;
  budget: number;
  total_price: number | null;
  status: ErrandStatus;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface RunnerStats {
  total_completed: number;
  total_cancellations: number;
  total_disputes: number;
  average_rating: number | null;
  total_ratings: number;
  completion_rate: number;
}

export default function RunnerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [errands, setErrands] = useState<Errand[]>([]);
  const [stats, setStats] = useState<RunnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch runner's errands
      const { data: errandsData, error: errandsError } = await supabase
        .from("errands")
        .select("*")
        .eq("runner_id", user!.id)
        .order("created_at", { ascending: false });

      if (errandsError) throw errandsError;
      setErrands(errandsData || []);

      // Fetch runner stats from view
      const { data: statsData, error: statsError } = await supabase
        .from("runner_stats")
        .select("*")
        .eq("runner_id", user!.id)
        .single();

      if (statsError && statsError.code !== "PGRST116") {
        console.error("Stats error:", statsError);
      }
      setStats(statsData || {
        total_completed: 0,
        total_cancellations: 0,
        total_disputes: 0,
        average_rating: null,
        total_ratings: 0,
        completion_rate: 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateErrandStatus = async (errandId: string, newStatus: string) => {
    setUpdating(errandId);
    try {
      const { data, error } = await supabase.functions.invoke("update-errand-status", {
        body: { errand_id: errandId, new_status: newStatus },
      });

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: data.message,
      });

      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update errand status",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: ErrandStatus) => {
    const variants: Record<ErrandStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      open: { variant: "secondary", label: "Open" },
      assigned: { variant: "default", label: "Assigned" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "outline", label: "Completed" },
      confirmed: { variant: "default", label: "Confirmed" },
      disputed: { variant: "destructive", label: "Disputed" },
      paid: { variant: "default", label: "Paid" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const [openMessages, setOpenMessages] = useState<Record<string, boolean>>({});

  const toggleMessages = (errandId: string) => {
    setOpenMessages(prev => ({ ...prev, [errandId]: !prev[errandId] }));
  };

  const activeErrands = errands.filter((e) => ["assigned", "in_progress"].includes(e.status));
  const completedErrands = errands.filter((e) => ["completed", "confirmed", "paid"].includes(e.status));
  const disputedErrands = errands.filter((e) => e.status === "disputed");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/wallet">
                <Wallet className="h-4 w-4 mr-1" />
                Wallet
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/errands-marketplace">Find Jobs</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Your Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.total_completed || 0}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Star className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {stats?.average_rating ? stats.average_rating.toFixed(1) : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.completion_rate || 0}%</p>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                  </div>
                </div>
                <Progress value={stats?.completion_rate || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.total_disputes || 0}</p>
                    <p className="text-sm text-muted-foreground">Disputes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Errands Tabs */}
        <section>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">
                Active ({activeErrands.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedErrands.length})
              </TabsTrigger>
              <TabsTrigger value="disputed">
                Disputed ({disputedErrands.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 space-y-4">
              {activeErrands.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active errands</p>
                    <Button className="mt-4" asChild>
                      <Link to="/errands-marketplace">Find Jobs</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeErrands.map((errand) => (
                  <Card key={errand.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{errand.title}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {errand.pickup_location || errand.location}
                            {errand.dropoff_location && ` → ${errand.dropoff_location}`}
                          </CardDescription>
                        </div>
                        {getStatusBadge(errand.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{errand.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-primary">
                            KES {(errand.total_price || errand.budget).toLocaleString()}
                          </p>
                          {errand.accepted_at && (
                            <p className="text-xs text-muted-foreground">
                              Accepted: {format(new Date(errand.accepted_at), "MMM d, h:mm a")}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {errand.status === "assigned" && (
                            <Button
                              onClick={() => updateErrandStatus(errand.id, "in_progress")}
                              disabled={updating === errand.id}
                            >
                              {updating === errand.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Start Job
                                </>
                              )}
                            </Button>
                          )}
                          {errand.status === "in_progress" && (
                            <Button
                              onClick={() => updateErrandStatus(errand.id, "completed")}
                              disabled={updating === errand.id}
                            >
                              {updating === errand.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Flag className="h-4 w-4 mr-1" />
                                  Mark Complete
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Messages */}
                      <Collapsible open={openMessages[errand.id]} onOpenChange={() => toggleMessages(errand.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between mt-2">
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Chat with Customer
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${openMessages[errand.id] ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <ErrandMessages
                            errandId={errand.id}
                            customerId={errand.customer_id || ""}
                            runnerId={user!.id}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4 space-y-4">
              {completedErrands.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No completed errands yet</p>
                  </CardContent>
                </Card>
              ) : (
                completedErrands.map((errand) => (
                  <Card key={errand.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{errand.title}</CardTitle>
                          <CardDescription>
                            {errand.pickup_location || errand.location}
                          </CardDescription>
                        </div>
                        {getStatusBadge(errand.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          {errand.completed_at && (
                            <p className="text-muted-foreground">
                              Completed: {format(new Date(errand.completed_at), "MMM d, yyyy h:mm a")}
                            </p>
                          )}
                          {errand.confirmed_at && (
                            <p className="text-green-600">
                              Confirmed: {format(new Date(errand.confirmed_at), "MMM d, yyyy h:mm a")}
                            </p>
                          )}
                        </div>
                        <p className="text-lg font-bold text-primary">
                          KES {(errand.total_price || errand.budget).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="disputed" className="mt-4 space-y-4">
              {disputedErrands.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No disputed errands</p>
                  </CardContent>
                </Card>
              ) : (
                disputedErrands.map((errand) => (
                  <Card key={errand.id} className="border-destructive/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{errand.title}</CardTitle>
                          <CardDescription>
                            {errand.pickup_location || errand.location}
                          </CardDescription>
                        </div>
                        {getStatusBadge(errand.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-destructive mb-2">
                        An issue was raised by the customer. An admin will review this.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Disputed
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}
