import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export function RejectModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: RejectModalProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Verification</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this runner's verification.
            This will be recorded in the admin notes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="reason">Rejection Reason</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., ID document is blurry, selfie doesn't match ID..."
            className="mt-2"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
          >
            {loading ? "Rejecting..." : "Reject Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
