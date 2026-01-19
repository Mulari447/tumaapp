import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DocumentViewer } from "@/components/admin/DocumentViewer";
import { RejectModal } from "@/components/admin/RejectModal";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Shield,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";

interface RunnerProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  user_type: string;
  verification_status: VerificationStatus | null;
  id_document_url: string | null;
  id_document_back_url: string | null;
  selfie_url: string | null;
  admin_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminVerificationDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { user } = useAuth();
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      if (!userId || !isAdmin) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        setProfile(data as RunnerProfile);
        setAdminNotes(data.admin_notes || "");
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast({
          title: "Error",
          description: "Failed to load runner profile.",
          variant: "destructive",
        });
        navigate("/admin");
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchProfile();
    }
  }, [userId, isAdmin, navigate]);

  const updateVerificationStatus = async (
    status: VerificationStatus,
    notes?: string
  ) => {
    if (!userId || !user) return;

    setActionLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        verification_status: status,
        admin_notes: notes || adminNotes || null,
      };

      if (status === "verified") {
        updateData.verified_at = new Date().toISOString();
        updateData.verified_by = user.id;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Runner verification status updated to ${status}.`,
      });

      navigate("/admin");
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update verification status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () => updateVerificationStatus("verified");
  
  const handleReject = (reason: string) => {
    setRejectModalOpen(false);
    updateVerificationStatus("rejected", reason);
  };
  
  const handleRequestResubmission = () => {
    updateVerificationStatus("pending", adminNotes + "\n[Requested resubmission]");
  };

  const getStatusBadge = (status: VerificationStatus | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "under_review":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Under Review</Badge>;
      case "verified":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Runner Verification</h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Queue
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Profile Information
                  {getStatusBadge(profile.verification_status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{profile.full_name || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{profile.phone || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{profile.location || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Registered</p>
                    <p className="font-medium">
                      {format(new Date(profile.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                {profile.bio && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Bio</p>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Admin Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes" className="sr-only">Notes</Label>
                <Textarea
                  id="notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this verification..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          {/* Documents */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submitted Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <DocumentViewer
                    label="ID Front"
                    url={profile.id_document_url}
                  />
                  <DocumentViewer
                    label="ID Back"
                    url={profile.id_document_back_url}
                  />
                  <DocumentViewer
                    label="Selfie with ID"
                    url={profile.selfie_url}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={actionLoading || profile.verification_status === "verified"}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={actionLoading || profile.verification_status === "rejected"}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRequestResubmission}
                    disabled={actionLoading || profile.verification_status === "pending"}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Request Resubmission
                  </Button>
                </div>

                {profile.verified_at && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Verified on {format(new Date(profile.verified_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <RejectModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        onConfirm={handleReject}
        loading={actionLoading}
      />
    </div>
  );
}
