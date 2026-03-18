import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface RunnerProfile {
  id: string;
  full_name: string | null;
  email: string;
  bio: string | null;
  location: string | null;
  transport_type: string | null;
  verification_status: string | null;
  created_at: string;
}

interface RunnerStatsData {
  total_completed: number;
  average_rating: number | null;
  total_ratings: number;
  completion_rate: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string | null;
}

export default function RunnerProfile() {
  const { runnerId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [stats, setStats] = useState<RunnerStatsData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (runnerId) fetchRunnerData();
  }, [runnerId]);

  const fetchRunnerData = async () => {
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, bio, location, transport_type, verification_status, created_at")
        .eq("id", runnerId!)
        .single();

      if (profileData) setProfile(profileData);

      // Fetch stats
      const { data: statsData } = await supabase
        .from("runner_stats")
        .select("total_completed, average_rating, total_ratings, completion_rate")
        .eq("runner_id", runnerId!)
        .single();

      setStats(statsData || { total_completed: 0, average_rating: null, total_ratings: 0, completion_rate: 0 });

      // Fetch reviews with customer names
      const { data: ratingsData } = await supabase
        .from("ratings")
        .select("id, rating, comment, created_at, customer_id")
        .eq("runner_id", runnerId!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (ratingsData && ratingsData.length > 0) {
        const customerIds = [...new Set(ratingsData.map(r => r.customer_id))];
        const { data: customers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);

        const customerMap = new Map(customers?.map(c => [c.id, c.full_name]));

        setReviews(ratingsData.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          customer_name: customerMap.get(r.customer_id) || "Customer",
        })));
      }
    } catch (error) {
      console.error("Error fetching runner data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Runner not found</p>
      </div>
    );
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : profile.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></Link>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Profile Header */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{profile.full_name || "Runner"}</h1>
                    {profile.verification_status === "verified" && (
                      <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
                    )}
                  </div>
                  {profile.location && (
                    <p className="text-muted-foreground flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3" /> {profile.location}
                    </p>
                  )}
                  {profile.transport_type && (
                    <p className="text-muted-foreground text-sm mt-1">Transport: {profile.transport_type}</p>
                  )}
                  {profile.bio && (
                    <p className="text-sm mt-3">{profile.bio}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Member since {new Date(profile.created_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{stats?.average_rating?.toFixed(1) || "N/A"}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stats?.total_ratings || 0} ratings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats?.total_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats?.completion_rate || 0}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.total_ratings || 0}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </CardContent>
            </Card>
          </div>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Reviews ({reviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{review.customer_name}</p>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(review.created_at).toLocaleDateString("en-KE")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
