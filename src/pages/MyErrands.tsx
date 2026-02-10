import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Loader2,
  FileText,
} from "lucide-react";
import { ErrandCard } from "@/components/errands/ErrandCard";

export default function MyErrands() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [errands, setErrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchErrands = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("errands")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setErrands(data || []);
    } catch (error) {
      console.error("Error fetching errands:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchErrands();
  }, [user]);

  const activeErrands = errands.filter((e) =>
    ["open", "assigned", "in_progress"].includes(e.status)
  );
  const pendingErrands = errands.filter((e) =>
    ["completed", "disputed"].includes(e.status)
  );
  const closedErrands = errands.filter((e) =>
    ["confirmed", "paid", "cancelled"].includes(e.status)
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Errands</h1>
              <p className="text-muted-foreground">Track and manage your errand requests.</p>
            </div>
            <Button onClick={() => navigate("/post-errand")}>
              <Plus className="h-4 w-4 mr-2" />
              New Errand
            </Button>
          </div>

          {errands.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No errands yet</h3>
                <p className="text-muted-foreground mb-6">Create your first errand!</p>
                <Button onClick={() => navigate("/post-errand")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post an Errand
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="active">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="active">Active ({activeErrands.length})</TabsTrigger>
                <TabsTrigger value="pending">
                  Needs Action ({pendingErrands.length})
                </TabsTrigger>
                <TabsTrigger value="closed">Closed ({closedErrands.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {activeErrands.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No active errands</CardContent></Card>
                ) : (
                  activeErrands.map((errand) => (
                    <ErrandCard key={errand.id} errand={errand} isCustomer={true} onUpdate={fetchErrands} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                {pendingErrands.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No errands needing action</CardContent></Card>
                ) : (
                  pendingErrands.map((errand) => (
                    <ErrandCard key={errand.id} errand={errand} isCustomer={true} onUpdate={fetchErrands} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="closed" className="space-y-4">
                {closedErrands.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No closed errands</CardContent></Card>
                ) : (
                  closedErrands.map((errand) => (
                    <ErrandCard key={errand.id} errand={errand} isCustomer={true} onUpdate={fetchErrands} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
      </main>
    </div>
  );
}
