import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Home,
  MapPin,
  Bed,
  Bath,
  Search,
  Loader2,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HouseListing {
  id: string;
  runner_id: string;
  title: string;
  description: string | null;
  location: string;
  monthly_rent: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[] | null;
  photos: string[];
  contact_phone: string | null;
  status: string;
  created_at: string;
}

export default function HouseListings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<HouseListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedListing, setSelectedListing] = useState<HouseListing | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [userType, setUserType] = useState<string>("customer");

  useEffect(() => {
    fetchListings();
    if (user) {
      supabase.from("profiles").select("user_type").eq("id", user.id).single()
        .then(({ data }) => { if (data) setUserType(data.user_type); });
    }
  }, [user]);

  const fetchListings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("house_listings" as any)
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching listings:", error);
    } else {
      setListings((data as any[]) || []);
    }
    setLoading(false);
  };

  const handleInquiry = async () => {
    if (!user || !selectedListing) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("house_inquiries" as any).insert({
        listing_id: selectedListing.id,
        customer_id: user.id,
        message: inquiryMessage,
        phone: inquiryPhone,
      } as any);

      if (error) throw error;
      toast({ title: "Inquiry Sent! 📬", description: "The listing owner will be in touch soon." });
      setInquiryOpen(false);
      setInquiryMessage("");
      setInquiryPhone("");
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to send inquiry", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = listings.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
            </Button>
            {userType === "runner" && (
              <Button size="sm" asChild>
                <Link to="/post-house-listing"><Plus className="h-4 w-4 mr-1" /> Post House</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Home className="h-8 w-8 text-primary" /> House Hunting
              </h1>
              <p className="text-muted-foreground mt-1">Browse available houses posted by our runners.</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No listings found</h3>
                <p className="text-muted-foreground">Check back later for new house listings.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((listing) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  className="cursor-pointer"
                  onClick={() => { setSelectedListing(listing); setPhotoIndex(0); }}
                >
                  <Card className="overflow-hidden hover:shadow-xl transition-shadow">
                    {/* Photo */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {listing.photos.length > 0 ? (
                        <img
                          src={listing.photos[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Home className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2 bg-primary">
                        KES {listing.monthly_rent.toLocaleString()}/mo
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-1">{listing.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3" /> {listing.location}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {listing.bedrooms} bed</span>
                        <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {listing.bathrooms} bath</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Listing Detail Dialog */}
      <Dialog open={!!selectedListing} onOpenChange={(open) => { if (!open) setSelectedListing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedListing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedListing.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {selectedListing.location}
                </DialogDescription>
              </DialogHeader>

              {/* Photo Gallery */}
              {selectedListing.photos.length > 0 && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedListing.photos[photoIndex]}
                    alt={`Photo ${photoIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {selectedListing.photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setPhotoIndex((prev) => (prev > 0 ? prev - 1 : selectedListing.photos.length - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setPhotoIndex((prev) => (prev < selectedListing.photos.length - 1 ? prev + 1 : 0))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 rounded-full px-3 py-1 text-xs">
                        {photoIndex + 1} / {selectedListing.photos.length}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-primary">
                    KES {selectedListing.monthly_rent.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {selectedListing.bedrooms} Bedrooms</span>
                    <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {selectedListing.bathrooms} Bathrooms</span>
                  </div>
                </div>

                {selectedListing.description && (
                  <p className="text-sm text-muted-foreground">{selectedListing.description}</p>
                )}

                {selectedListing.amenities && selectedListing.amenities.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedListing.amenities.map((a, i) => (
                        <Badge key={i} variant="secondary">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedListing.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-primary" />
                    <a href={`tel:${selectedListing.contact_phone}`} className="text-primary font-medium">
                      {selectedListing.contact_phone}
                    </a>
                  </div>
                )}

                {user && user.id !== selectedListing.runner_id && (
                  <Button className="w-full" onClick={() => setInquiryOpen(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" /> I'm Interested
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Inquiry Dialog */}
      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Inquiry</DialogTitle>
            <DialogDescription>
              Let the listing owner know you're interested.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Phone Number</label>
              <Input
                placeholder="0712345678"
                value={inquiryPhone}
                onChange={(e) => setInquiryPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optional)</label>
              <Textarea
                placeholder="I'm interested in this house. When can I view it?"
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInquiryOpen(false)}>Cancel</Button>
            <Button onClick={handleInquiry} disabled={submitting || !inquiryPhone.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
