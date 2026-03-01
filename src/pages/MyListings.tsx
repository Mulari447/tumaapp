import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Home,
  MapPin,
  Bed,
  Bath,
  Phone,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface HouseListing {
  id: string;
  title: string;
  description: string | null;
  location: string;
  monthly_rent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  contact_phone: string | null;
  amenities: string[] | null;
  photos: string[] | null;
  status: string;
  created_at: string;
}

export default function MyListings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<HouseListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editListing, setEditListing] = useState<HouseListing | null>(null);
  const [deleteListing, setDeleteListing] = useState<HouseListing | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editRent, setEditRent] = useState("");
  const [editBedrooms, setEditBedrooms] = useState("");
  const [editBathrooms, setEditBathrooms] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAmenities, setEditAmenities] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const [inquiryCounts, setInquiryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) fetchListings();
  }, [user]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("house_listings")
        .select("*")
        .eq("runner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setListings(data || []);

      // Fetch inquiry counts for all listings
      if (data && data.length > 0) {
        const ids = data.map((l) => l.id);
        const { data: inquiries, error: iqErr } = await supabase
          .from("house_inquiries")
          .select("listing_id")
          .in("listing_id", ids);
        if (!iqErr && inquiries) {
          const counts: Record<string, number> = {};
          inquiries.forEach((iq) => {
            counts[iq.listing_id] = (counts[iq.listing_id] || 0) + 1;
          });
          setInquiryCounts(counts);
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load listings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (l: HouseListing) => {
    setEditListing(l);
    setEditTitle(l.title);
    setEditDescription(l.description || "");
    setEditLocation(l.location);
    setEditRent(String(l.monthly_rent));
    setEditBedrooms(String(l.bedrooms ?? 1));
    setEditBathrooms(String(l.bathrooms ?? 1));
    setEditPhone(l.contact_phone || "");
    setEditAmenities((l.amenities || []).join(", "));
  };

  const handleSaveEdit = async () => {
    if (!editListing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("house_listings")
        .update({
          title: editTitle,
          description: editDescription,
          location: editLocation,
          monthly_rent: Number(editRent),
          bedrooms: Number(editBedrooms),
          bathrooms: Number(editBathrooms),
          contact_phone: editPhone,
          amenities: editAmenities.split(",").map((a) => a.trim()).filter(Boolean),
        })
        .eq("id", editListing.id);
      if (error) throw error;
      toast({ title: "Updated!", description: "Listing updated successfully." });
      setEditListing(null);
      fetchListings();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update listing", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkTaken = async (id: string) => {
    try {
      const { error } = await supabase
        .from("house_listings")
        .update({ status: "taken" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Marked as Taken", description: "This listing is no longer visible to customers." });
      fetchListings();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleMarkAvailable = async (id: string) => {
    try {
      const { error } = await supabase
        .from("house_listings")
        .update({ status: "available" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Listing Restored", description: "This listing is visible again." });
      fetchListings();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteListing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("house_listings")
        .delete()
        .eq("id", deleteListing.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Listing removed permanently." });
      setDeleteListing(null);
      fetchListings();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete listing", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/post-house-listing"><Plus className="h-4 w-4 mr-1" /> New Listing</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Home className="h-8 w-8 text-primary" /> My Listings
        </h1>
        <p className="text-muted-foreground mb-6">Manage your house listings.</p>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You haven't posted any listings yet.</p>
              <Button asChild><Link to="/post-house-listing">Post Your First Listing</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <Card key={listing.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{listing.title}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {listing.location}
                      </p>
                    </div>
                    <Badge variant={listing.status === "available" ? "default" : "secondary"}>
                      {listing.status === "available" ? "Available" : "Taken"}
                    </Badge>
                    {(inquiryCounts[listing.id] || 0) > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {inquiryCounts[listing.id]} {inquiryCounts[listing.id] === 1 ? "inquiry" : "inquiries"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {listing.photos && listing.photos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {listing.photos.slice(0, 4).map((photo, i) => (
                        <img key={i} src={photo} alt="" className="h-20 w-20 rounded-md object-cover flex-shrink-0" />
                      ))}
                      {listing.photos.length > 4 && (
                        <div className="h-20 w-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-sm text-muted-foreground">
                          +{listing.photos.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="font-semibold text-foreground text-lg">KES {listing.monthly_rent.toLocaleString()}/mo</span>
                    <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {listing.bedrooms ?? 0}</span>
                    <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {listing.bathrooms ?? 0}</span>
                    {listing.contact_phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {listing.contact_phone}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(listing)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    {listing.status === "available" ? (
                      <Button variant="outline" size="sm" onClick={() => handleMarkTaken(listing.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark as Taken
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleMarkAvailable(listing.id)}>
                        Restore
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => setDeleteListing(listing)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editListing} onOpenChange={(open) => !open && setEditListing(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Rent (KES)</label>
                <Input type="number" value={editRent} onChange={(e) => setEditRent(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Bedrooms</label>
                <Input type="number" value={editBedrooms} onChange={(e) => setEditBedrooms(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Bathrooms</label>
                <Input type="number" value={editBathrooms} onChange={(e) => setEditBathrooms(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Contact Phone</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Amenities (comma-separated)</label>
              <Input value={editAmenities} onChange={(e) => setEditAmenities(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditListing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteListing} onOpenChange={(open) => !open && setDeleteListing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteListing?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
