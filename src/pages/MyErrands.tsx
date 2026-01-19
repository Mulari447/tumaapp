import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  Loader2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

type ErrandStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled";
type ErrandCategory = "groceries" | "delivery" | "cleaning" | "laundry" | "moving" | "other";

interface Errand {
  id: string;
  title: string;
  category: ErrandCategory;
  description: string;
  location: string;
  budget: number;
  status: ErrandStatus;
  created_at: string;
}

export default function MyErrands() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function fetchErrands() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("errands")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setErrands((data as Errand[]) || []);
      } catch (error) {
        console.error("Error fetching errands:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchErrands();
    }
  }, [user]);

  const getStatusBadge = (status: ErrandStatus) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
      case "assigned":
        return <Badge className="bg-yellow-100 text-yellow-800">Assigned</Badge>;
      case "in_progress":
        return <Badge className="bg-purple-100 text-purple-800">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getCategoryLabel = (category: ErrandCategory) => {
    const labels: Record<ErrandCategory, string> = {
      groceries: "Groceries",
      delivery: "Delivery",
      cleaning: "Cleaning",
      laundry: "Laundry",
      moving: "Moving",
      other: "Other",
    };
    return labels[category];
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-background to-sand-light">
      {/* Header */}
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary">Errandi</Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
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
              <p className="text-muted-foreground">
                Track and manage your errand requests.
              </p>
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
                <p className="text-muted-foreground mb-6">
                  You haven't posted any errands. Create your first one!
                </p>
                <Button onClick={() => navigate("/post-errand")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post an Errand
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {errands.map((errand) => (
                <Card key={errand.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{errand.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getCategoryLabel(errand.category)}
                          </Badge>
                          <span className="text-xs">•</span>
                          <span className="text-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {errand.location}
                          </span>
                        </CardDescription>
                      </div>
                      {getStatusBadge(errand.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {errand.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          KES {errand.budget.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(errand.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      {errand.status === "open" && (
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
