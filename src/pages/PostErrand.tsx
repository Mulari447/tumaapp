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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ShoppingBag,
  Truck,
  Sparkles,
  Shirt,
  PackageOpen,
  HelpCircle,
  MapPin,
  Clock,
  Loader2,
} from "lucide-react";
import { LocationPicker } from "@/components/maps/LocationPicker";

const categories = [
  { value: "groceries", label: "Groceries", icon: ShoppingBag, description: "Shopping & supplies" },
  { value: "delivery", label: "Delivery", icon: Truck, description: "Pick up & drop off" },
  { value: "cleaning", label: "Cleaning", icon: Sparkles, description: "Home cleaning" },
  { value: "laundry", label: "Laundry", icon: Shirt, description: "Wash & fold" },
  { value: "moving", label: "Moving", icon: PackageOpen, description: "Light moving help" },
  { value: "other", label: "Other", icon: HelpCircle, description: "Custom errands" },
] as const;

const errandSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must be less than 100 characters"),
  category: z.enum(["groceries", "delivery", "cleaning", "laundry", "moving", "other"], {
    required_error: "Please select a category",
  }),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description must be less than 1000 characters"),
  pickup_location: z
    .string()
    .trim()
    .min(5, "Pickup location must be at least 5 characters")
    .max(200, "Pickup location must be less than 200 characters"),
  dropoff_location: z
    .string()
    .trim()
    .min(5, "Drop-off location must be at least 5 characters")
    .max(200, "Drop-off location must be less than 200 characters"),
  estimated_hours: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0.5, {
      message: "Estimated time must be at least 0.5 hours",
    })
    .refine((val) => Number(val) <= 24, {
      message: "Maximum estimated time is 24 hours",
    }),
});

type ErrandFormData = z.infer<typeof errandSchema>;

const BASE_RATE = 150;
const HOURLY_RATE = 150;

const calculatePrice = (hours: number) => BASE_RATE + (hours * HOURLY_RATE);

export default function PostErrand() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);

  const form = useForm<ErrandFormData>({
    resolver: zodResolver(errandSchema),
    defaultValues: {
      title: "",
      category: undefined,
      description: "",
      pickup_location: "",
      dropoff_location: "",
      estimated_hours: "1",
    },
  });

  const estimatedHours = Number(form.watch("estimated_hours")) || 1;
  const calculatedPrice = calculatePrice(estimatedHours);

  const handleLocationChange = (location: { lat: number; lng: number; address: string }) => {
    setPickupCoords({ lat: location.lat, lng: location.lng });
    form.setValue('pickup_location', location.address);
  };

  const onSubmit = async (data: ErrandFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to post an errand.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("errands").insert({
        customer_id: user.id,
        title: data.title,
        category: data.category,
        description: data.description,
        location: data.pickup_location, // Keep for backwards compatibility
        pickup_location: data.pickup_location,
        dropoff_location: data.dropoff_location,
        estimated_hours: Number(data.estimated_hours),
        budget: calculatedPrice,
        latitude: pickupCoords?.lat || null,
        longitude: pickupCoords?.lng || null,
      });

      if (error) throw error;

      toast({
        title: "Errand Posted! 🎉",
        description: "Your errand request has been published. Runners will be notified.",
      });

      navigate("/my-errands");
    } catch (error: unknown) {
      console.error("Error posting errand:", error);
      toast({
        title: "Error",
        description: "Failed to post errand. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Post an Errand</h1>
            <p className="text-muted-foreground">
              Describe what you need done and we'll find a runner for you.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Errand Details</CardTitle>
              <CardDescription>
                Provide clear details to help runners understand your request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Pick up groceries from Carrefour"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {categories.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = field.value === cat.value;
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => field.onChange(cat.value)}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                <p className="font-medium text-sm">{cat.label}</p>
                                <p className="text-xs text-muted-foreground">{cat.description}</p>
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide details about what you need done, including any specific instructions..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Pickup Location with Map */}
                  <FormField
                    control={form.control}
                    name="pickup_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Pickup Location
                        </FormLabel>
                        <FormControl>
                          <LocationPicker
                            value={pickupCoords ? { ...pickupCoords, address: field.value } : undefined}
                            onChange={handleLocationChange}
                            placeholder="Enter pickup location or use current location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Drop-off Location */}
                  <FormField
                    control={form.control}
                    name="dropoff_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Drop-off Location
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Kilimani, Nairobi"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Estimated Hours */}
                  <FormField
                    control={form.control}
                    name="estimated_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Estimated Time (hours)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1"
                            min="0.5"
                            max="24"
                            step="0.5"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Calculated Price */}
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total Price</p>
                        <p className="text-xs text-muted-foreground">
                          Base rate (KES {BASE_RATE}) + {estimatedHours} hrs × KES {HOURLY_RATE}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        KES {calculatedPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate("/dashboard")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        "Post Errand"
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
