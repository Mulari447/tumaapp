import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Search,
  Filter,
  ShoppingCart,
  Truck,
  Sparkles,
  Package,
  Home,
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Map,
  List,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { NearbyErrandsMap } from "@/components/maps/NearbyErrandsMap";

type ErrandCategory = "groceries" | "delivery" | "cleaning" | "laundry" | "moving" | "other";

interface Errand {
  id: string;
  title: string;
  category: ErrandCategory;
  description: string;
  location: string;
  budget: number;
  created_at: string;
  customer_id: string;
}

const categoryIcons: Record<ErrandCategory, React.ReactNode> = {
  groceries: <ShoppingCart className="h-5 w-5" />,
  delivery: <Truck className="h-5 w-5" />,
  cleaning: <Sparkles className="h-5 w-5" />,
  laundry: <Package className="h-5 w-5" />,
  moving: <Home className="h-5 w-5" />,
  other: <MoreHorizontal className="h-5 w-5" />,
};

const categoryLabels: Record<ErrandCategory, string> = {
  groceries: "Groceries",
  delivery: "Delivery",
  cleaning: "Cleaning",
  laundry: "Laundry",
  moving: "Moving",
  other: "Other",
};

const categoryColors: Record<ErrandCategory, string> = {
  groceries: "bg-green-100 text-green-800 border-green-200",
  delivery: "bg-blue-100 text-blue-800 border-blue-200",
  cleaning: "bg-purple-100 text-purple-800 border-purple-200",
  laundry: "bg-cyan-100 text-cyan-800 border-cyan-200",
  moving: "bg-orange-100 text-orange-800 border-orange-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function ErrandsMarketplace() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ErrandCategory>("all");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedErrand, setSelectedErrand] = useState<Errand | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function checkVerification() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_type, verification_status")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.user_type !== "runner") {
          toast.error("This page is for verified runners only");
          navigate("/dashboard");
          return;
        }

        if (data?.verification_status !== "verified") {
          toast.error("Your account must be verified to access the marketplace");
          navigate("/dashboard");
          return;
        }

        setIsVerified(true);
      } catch (error) {
        console.error("Error checking verification:", error);
        navigate("/dashboard");
      }
    }

    if (user) {
      checkVerification();
    }
  }, [user, navigate]);

  const fetchErrands = async () => {
    if (!user || !isVerified) return;

    setLoading(true);
    try {
      let query = supabase
        .from("errands")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setErrands((data as Errand[]) || []);
    } catch (error) {
      console.error("Error fetching errands:", error);
      toast.error("Failed to load errands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVerified) {
      fetchErrands();
    }
  }, [isVerified, categoryFilter]);

  const handleAcceptClick = (errand: Errand) => {
    setSelectedErrand(errand);
    setConfirmDialogOpen(true);
  };

  const handleAcceptErrand = async () => {
    if (!selectedErrand || !user) return;

    setAcceptingId(selectedErrand.id);
    setConfirmDialogOpen(false);

    try {
      const { error } = await supabase
        .from("errands")
        .update({
          runner_id: user.id,
          status: "assigned",
        })
        .eq("id", selectedErrand.id)
        .eq("status", "open");

      if (error) throw error;

      toast.success("Errand accepted! You can now start working on it.");
      setErrands(errands.filter((e) => e.id !== selectedErrand.id));
    } catch (error) {
      console.error("Error accepting errand:", error);
      toast.error("Failed to accept errand. It may have already been taken.");
      fetchErrands();
    } finally {
      setAcceptingId(null);
      setSelectedErrand(null);
    }
  };

  const filteredErrands = errands.filter((errand) =>
    errand.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    errand.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    errand.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || (loading && !isVerified)) {
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
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Errands Marketplace</h1>
              <p className="text-muted-foreground">
                Browse and accept available errands in your area.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")}>
                <TabsList>
                  <TabsTrigger value="list" className="flex items-center gap-1">
                    <List className="h-4 w-4" />
                    List
                  </TabsTrigger>
                  <TabsTrigger value="map" className="flex items-center gap-1">
                    <Map className="h-4 w-4" />
                    Map
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={fetchErrands} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, description, or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={categoryFilter}
                    onValueChange={(value) => setCategoryFilter(value as "all" | ErrandCategory)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="groceries">Groceries</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="laundry">Laundry</SelectItem>
                      <SelectItem value="moving">Moving</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="mb-4 text-sm text-muted-foreground">
            {loading ? (
              "Loading errands..."
            ) : (
              `${filteredErrands.length} errand${filteredErrands.length !== 1 ? "s" : ""} available`
            )}
          </div>

          {/* Map View */}
          {viewMode === "map" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Nearby Errands Map
                </CardTitle>
                <CardDescription>
                  Find errands near your current location. Update your location to refresh.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NearbyErrandsMap
                  radiusKm={15}
                  onErrandSelect={(errand) => {
                    setSelectedErrand({
                      id: errand.errand_id,
                      title: errand.title,
                      description: errand.description,
                      category: errand.category as ErrandCategory,
                      location: errand.location,
                      budget: errand.budget,
                      created_at: errand.created_at,
                      customer_id: '',
                    });
                    setConfirmDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Errands Grid (List View) */}
          {viewMode === "list" && (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredErrands.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No errands found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery || categoryFilter !== "all"
                        ? "Try adjusting your filters or search query."
                        : "Check back later for new errands in your area."}
                    </p>
                    {(searchQuery || categoryFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          setCategoryFilter("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredErrands.map((errand, index) => (
                  <motion.div
                    key={errand.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={`${categoryColors[errand.category]} flex items-center gap-1`}
                          >
                            {categoryIcons[errand.category]}
                            {categoryLabels[errand.category]}
                          </Badge>
                          <span className="text-lg font-bold text-primary">
                            KES {errand.budget.toLocaleString()}
                          </span>
                        </div>
                        <CardTitle className="text-lg mt-2 line-clamp-2">
                          {errand.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {errand.description}
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{errand.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>Posted {format(new Date(errand.created_at), "MMM d, h:mm a")}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-3 border-t">
                        <Button
                          className="w-full"
                          onClick={() => handleAcceptClick(errand)}
                          disabled={acceptingId === errand.id}
                        >
                          {acceptingId === errand.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Accept Errand
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
            </>
          )}
        </motion.div>
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this errand?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedErrand && (
                <div className="space-y-2 mt-2">
                  <p className="font-medium text-foreground">{selectedErrand.title}</p>
                  <p className="text-sm">Location: {selectedErrand.location}</p>
                  <p className="text-sm">Budget: <span className="font-semibold text-primary">KES {selectedErrand.budget.toLocaleString()}</span></p>
                  <p className="text-sm mt-4">
                    Once accepted, you'll be responsible for completing this errand. 
                    The customer will be notified of your acceptance.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptErrand}>
              Accept Errand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
