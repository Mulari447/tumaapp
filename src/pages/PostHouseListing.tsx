import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Home,
  MapPin,
  Upload,
  X,
  Loader2,
  ImagePlus,
  Bed,
  Bath,
  Phone,
} from "lucide-react";

const listingSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(100),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(1000),
  location: z.string().trim().min(3, "Location is required").max(200),
  monthly_rent: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 1000, {
    message: "Monthly rent must be at least KES 1,000",
  }),
  bedrooms: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Invalid number",
  }),
  bathrooms: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Invalid number",
  }),
  contact_phone: z.string().trim().min(10, "Enter a valid phone number").max(15),
  amenities: z.string().optional(),
});

type ListingFormData = z.infer<typeof listingSchema>;

export default function PostHouseListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      monthly_rent: "",
      bedrooms: "1",
      bathrooms: "1",
      contact_phone: "",
      amenities: "",
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 10) {
      toast({ title: "Too many photos", description: "Maximum 10 photos allowed", variant: "destructive" });
      return;
    }
    const newPhotos = [...photos, ...files];
    setPhotos(newPhotos);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user || photos.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];

    for (const photo of photos) {
      const ext = photo.name.split(".").pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("house-photos").upload(path, photo);
      if (error) {
        console.error("Upload error:", error);
        continue;
      }
      const { data: urlData } = supabase.storage.from("house-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }

    setUploading(false);
    return urls;
  };

  const onSubmit = async (data: ListingFormData) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (photos.length === 0) {
      toast({ title: "Photos required", description: "Please add at least one photo of the house", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const photoUrls = await uploadPhotos();

      const amenitiesArray = data.amenities
        ? data.amenities.split(",").map((a) => a.trim()).filter(Boolean)
        : [];

      const { error } = await supabase.from("house_listings" as any).insert({
        runner_id: user.id,
        title: data.title,
        description: data.description,
        location: data.location,
        monthly_rent: Number(data.monthly_rent),
        bedrooms: Number(data.bedrooms),
        bathrooms: Number(data.bathrooms),
        contact_phone: data.contact_phone,
        amenities: amenitiesArray,
        photos: photoUrls,
      } as any);

      if (error) throw error;

      toast({ title: "Listing Posted! 🏠", description: "Your house listing is now visible to customers." });
      navigate("/house-listings");
    } catch (error) {
      console.error("Error posting listing:", error);
      toast({ title: "Error", description: "Failed to post listing. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Home className="h-8 w-8 text-primary" /> Post a House
            </h1>
            <p className="text-muted-foreground">List a house for customers looking for accommodation.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>House Details</CardTitle>
              <CardDescription>Provide accurate details and clear photos to attract tenants.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="e.g., Spacious 2BR in Kilimani" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the property — layout, features, nearby amenities..." rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</FormLabel>
                      <FormControl><Input placeholder="e.g., Kilimani, Nairobi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="monthly_rent" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent (KES)</FormLabel>
                        <FormControl><Input type="number" placeholder="25000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bedrooms" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Bed className="h-4 w-4" /> Bedrooms</FormLabel>
                        <FormControl><Input type="number" min="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bathrooms" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Bath className="h-4 w-4" /> Bathrooms</FormLabel>
                        <FormControl><Input type="number" min="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="contact_phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Phone className="h-4 w-4" /> Contact Phone</FormLabel>
                      <FormControl><Input placeholder="0748 390 976" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="amenities" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amenities (comma-separated)</FormLabel>
                      <FormControl><Input placeholder="Parking, WiFi, Security, Water tank" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Photo Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" /> Photos (up to 10)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {photoPreviews.map((preview, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img src={preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 10 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Add Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoSelect}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/dashboard")}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={loading || uploading}>
                      {loading || uploading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploading ? "Uploading photos..." : "Posting..."}</>
                      ) : (
                        "Post Listing"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
