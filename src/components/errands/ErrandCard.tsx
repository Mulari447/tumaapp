import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Star,
  Loader2,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ErrandMessages } from "./ErrandMessages";

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
  runner_id: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface ErrandCardProps {
  errand: Errand;
  isCustomer: boolean;
  onUpdate: () => void;
}

export function ErrandCard({ errand, isCustomer, onUpdate }: ErrandCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Show messages for active errands (assigned, in_progress, completed)
  const canShowMessages = ["assigned", "in_progress", "completed", "disputed"].includes(errand.status) && errand.runner_id;

  const updateStatus = async (newStatus: string, reason?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-errand-status", {
        body: { 
          errand_id: errand.id, 
          new_status: newStatus,
          dispute_reason: reason,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message,
      });

      // If confirmed, show rating dialog
      if (newStatus === "confirmed") {
        setConfirmOpen(false);
        setRatingOpen(true);
      }

      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update errand status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDisputeOpen(false);
    }
  };

  const submitRating = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("ratings").insert({
        errand_id: errand.id,
        customer_id: errand.id, // Will be replaced with actual customer id
        runner_id: errand.runner_id,
        rating,
        comment: comment || null,
      });

      if (error) throw error;

      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!",
      });

      setRatingOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: "Failed to submit rating",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ErrandStatus) => {
    const variants: Record<ErrandStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
      open: { variant: "secondary", label: "Open" },
      assigned: { variant: "default", label: "Assigned", className: "bg-blue-500" },
      in_progress: { variant: "default", label: "In Progress", className: "bg-amber-500" },
      completed: { variant: "outline", label: "Awaiting Confirmation", className: "border-green-500 text-green-600" },
      confirmed: { variant: "default", label: "Confirmed", className: "bg-green-500" },
      disputed: { variant: "destructive", label: "Disputed" },
      paid: { variant: "default", label: "Paid", className: "bg-green-600" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const { variant, label, className } = variants[status];
    return <Badge variant={variant} className={className}>{label}</Badge>;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      groceries: "🛒 Groceries",
      delivery: "📦 Delivery",
      cleaning: "✨ Cleaning",
      laundry: "👕 Laundry",
      moving: "📦 Moving",
      other: "📋 Other",
    };
    return labels[category] || category;
  };

  return (
    <>
      <Card className={errand.status === "completed" && isCustomer ? "border-green-500/50 ring-2 ring-green-500/20" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{errand.title}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <span className="text-sm">{getCategoryLabel(errand.category)}</span>
              </CardDescription>
            </div>
            {getStatusBadge(errand.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{errand.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{errand.pickup_location || errand.location}</span>
            </div>
            {errand.dropoff_location && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>→ {errand.dropoff_location}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Posted: {format(new Date(errand.created_at), "MMM d, yyyy h:mm a")}</p>
            {errand.accepted_at && (
              <p className="text-blue-600">Accepted: {format(new Date(errand.accepted_at), "MMM d, h:mm a")}</p>
            )}
            {errand.started_at && (
              <p className="text-amber-600">Started: {format(new Date(errand.started_at), "MMM d, h:mm a")}</p>
            )}
            {errand.completed_at && (
              <p className="text-green-600">Completed: {format(new Date(errand.completed_at), "MMM d, h:mm a")}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-lg font-bold text-primary">
              KES {(errand.total_price || errand.budget).toLocaleString()}
            </p>

            {/* Customer confirmation actions */}
            {isCustomer && errand.status === "completed" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisputeOpen(true)}
                  className="text-destructive border-destructive"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Raise Issue
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
              </div>
            )}
          </div>

          {/* Messaging Section */}
          {canShowMessages && (
            <Collapsible open={messagesOpen} onOpenChange={setMessagesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between mt-2">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${messagesOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ErrandMessages
                  errandId={errand.id}
                  customerId={errand.customer_id}
                  runnerId={errand.runner_id}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Errand Completion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure the runner has completed this errand satisfactorily? 
              This will release the payment of KES {(errand.total_price || errand.budget).toLocaleString()} to the runner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateStatus("confirmed")}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Release Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise an Issue</DialogTitle>
            <DialogDescription>
              Please describe the issue with this errand. An admin will review your complaint.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe the issue..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateStatus("disputed", disputeReason)}
              disabled={loading || !disputeReason.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Your Runner</DialogTitle>
            <DialogDescription>
              How was your experience with this errand?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Add a comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingOpen(false)}>
              Skip
            </Button>
            <Button onClick={submitRating} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
