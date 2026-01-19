import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, User } from "lucide-react";
import { format } from "date-fns";

type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";

interface Runner {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  verification_status: VerificationStatus | null;
  created_at: string;
  updated_at: string;
}

interface VerificationQueueProps {
  runners: Runner[];
  loading: boolean;
}

export function VerificationQueue({ runners, loading }: VerificationQueueProps) {
  const navigate = useNavigate();

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (runners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No runners found</h3>
        <p className="text-muted-foreground">
          There are no runners matching your filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Runner</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runners.map((runner) => (
            <TableRow key={runner.id}>
              <TableCell className="font-medium">
                {runner.full_name || "—"}
              </TableCell>
              <TableCell>{runner.email}</TableCell>
              <TableCell>{runner.phone || "—"}</TableCell>
              <TableCell>{getStatusBadge(runner.verification_status)}</TableCell>
              <TableCell>
                {format(new Date(runner.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/verification/${runner.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
