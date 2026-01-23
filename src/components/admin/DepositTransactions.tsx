import { useState, useEffect, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  Wallet,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TransactionMetadata {
  failure_reason?: string;
  failed_reason?: string;
  processed_at?: string;
  failed_at?: string;
  resolved_by_admin?: boolean;
  admin_resolution_note?: string;
  admin_resolved_at?: string;
  [key: string]: unknown;
}

interface DepositTransaction {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  mpesa_reference: string | null;
  phone_number: string | null;
  metadata: TransactionMetadata | null;
  user_email?: string;
  user_name?: string;
}

interface DepositStats {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  totalAmount: number;
}

type FilterStatus = "all" | "pending" | "completed" | "failed";

export function DepositTransactions() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);
  const [stats, setStats] = useState<DepositStats>({
    total: 0,
    successful: 0,
    pending: 0,
    failed: 0,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<DepositTransaction | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionAction, setResolutionAction] = useState<"complete" | "fail">("complete");
  const [resolutionNote, setResolutionNote] = useState("");
  const [manualReference, setManualReference] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all deposit transactions
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("type", "deposit")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch wallet info for each transaction
      const walletIds = [...new Set((data || []).map((tx) => tx.wallet_id))];
      const { data: walletsData } = await supabase
        .from("wallets")
        .select("id, user_id")
        .in("id", walletIds);

      const userIds = [...new Set((walletsData || []).map((w) => w.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const walletToUser = new Map(walletsData?.map((w) => [w.id, w.user_id]) || []);
      const userToProfile = new Map(profilesData?.map((p) => [p.id, p]) || []);

      const formattedData: DepositTransaction[] = (data || []).map((tx) => {
        const userId = walletToUser.get(tx.wallet_id);
        const profile = userId ? userToProfile.get(userId) : null;
        return {
          ...tx,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || "Unknown",
          metadata: tx.metadata as TransactionMetadata | null,
        };
      });

      // Apply search filter
      const filtered = searchQuery
        ? formattedData.filter(
            (tx) =>
              tx.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tx.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tx.mpesa_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tx.phone_number?.includes(searchQuery)
          )
        : formattedData;

      setTransactions(filtered);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load deposit transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("status, amount")
        .eq("type", "deposit");

      if (error) throw error;

      const newStats: DepositStats = {
        total: data?.length || 0,
        successful: 0,
        pending: 0,
        failed: 0,
        totalAmount: 0,
      };

      data?.forEach((tx) => {
        if (tx.status === "completed") {
          newStats.successful++;
          newStats.totalAmount += Number(tx.amount);
        } else if (tx.status === "pending") {
          newStats.pending++;
        } else if (tx.status === "failed") {
          newStats.failed++;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [fetchTransactions, fetchStats]);

  const handleResolveTransaction = async () => {
    if (!selectedTransaction) return;

    setResolving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newStatus = resolutionAction === "complete" ? "completed" : "failed";
      const now = new Date().toISOString();

      // Update transaction
      const updatedMetadata: TransactionMetadata = {
        ...selectedTransaction.metadata,
        resolved_by_admin: true,
        admin_resolution_note: resolutionNote,
        admin_resolved_at: now,
        ...(resolutionAction === "complete"
          ? { processed_at: now }
          : { failed_at: now, failure_reason: resolutionNote || "Manually marked as failed by admin" }),
      };

      const { error: txError } = await supabase
        .from("transactions")
        .update({
          status: newStatus,
          mpesa_reference: manualReference || selectedTransaction.mpesa_reference,
          metadata: updatedMetadata as Json,
          updated_at: now,
        })
        .eq("id", selectedTransaction.id);

      if (txError) throw txError;

      // If completing, credit the wallet
      if (resolutionAction === "complete") {
        // Get wallet
        const { data: walletData, error: walletFetchError } = await supabase
          .from("wallets")
          .select("balance")
          .eq("id", selectedTransaction.wallet_id)
          .single();

        if (walletFetchError) throw walletFetchError;

        const newBalance = Number(walletData.balance) + Number(selectedTransaction.amount);

        const { error: walletError } = await supabase
          .from("wallets")
          .update({ balance: newBalance, updated_at: now })
          .eq("id", selectedTransaction.wallet_id);

        if (walletError) throw walletError;
      }

      toast({
        title: "Transaction Resolved",
        description: `Transaction has been marked as ${newStatus}`,
      });

      setResolveModalOpen(false);
      setSelectedTransaction(null);
      setResolutionNote("");
      setManualReference("");
      fetchTransactions();
      fetchStats();
    } catch (error) {
      console.error("Error resolving transaction:", error);
      toast({
        title: "Error",
        description: "Failed to resolve transaction",
        variant: "destructive",
      });
    } finally {
      setResolving(false);
    }
  };

  const openResolveModal = (tx: DepositTransaction) => {
    setSelectedTransaction(tx);
    setResolutionAction("complete");
    setResolutionNote("");
    setManualReference(tx.mpesa_reference || "");
    setResolveModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Successful
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFailureReason = (tx: DepositTransaction): string | null => {
    if (tx.status !== "failed" || !tx.metadata) return null;
    return tx.metadata.failure_reason || tx.metadata.failed_reason || null;
  };

  const statItems = [
    {
      label: "Total Deposits",
      value: stats.total,
      icon: Wallet,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Successful",
      value: stats.successful,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Amount Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Deposited (Successful)</p>
              <p className="text-2xl font-bold text-green-600">
                KES {stats.totalAmount.toLocaleString()}
              </p>
            </div>
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Deposit Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                fetchTransactions();
                fetchStats();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No deposit transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        <div>
                          <p className="font-medium">
                            {format(new Date(tx.created_at), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), "h:mm a")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tx.user_name}</p>
                          <p className="text-xs text-muted-foreground">{tx.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{tx.phone_number || "-"}</TableCell>
                      <TableCell className="font-medium">
                        KES {Number(tx.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {tx.mpesa_reference || "-"}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>
                        {tx.status === "failed" && getFailureReason(tx) && (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="max-w-32 truncate">{getFailureReason(tx)}</span>
                          </div>
                        )}
                        {tx.metadata?.resolved_by_admin && (
                          <Badge variant="outline" className="text-xs">
                            Admin resolved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResolveModal(tx)}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Transaction</DialogTitle>
            <DialogDescription>
              Manually resolve this pending deposit. This action will update the transaction
              status and, if successful, credit the user's wallet.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">User:</span>{" "}
                  {selectedTransaction.user_name} ({selectedTransaction.user_email})
                </p>
                <p>
                  <span className="text-muted-foreground">Amount:</span> KES{" "}
                  {Number(selectedTransaction.amount).toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  {selectedTransaction.phone_number || "N/A"}
                </p>
                <p>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {format(new Date(selectedTransaction.created_at), "PPpp")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Resolution Action</Label>
                <Select
                  value={resolutionAction}
                  onValueChange={(v) => setResolutionAction(v as "complete" | "fail")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complete">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Mark as Successful (Credit Wallet)
                      </div>
                    </SelectItem>
                    <SelectItem value="fail">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        Mark as Failed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resolutionAction === "complete" && (
                <div className="space-y-2">
                  <Label htmlFor="manual-reference">M-Pesa Reference (Optional)</Label>
                  <Input
                    id="manual-reference"
                    placeholder="e.g., ABC123XYZ"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="resolution-note">
                  Resolution Note {resolutionAction === "fail" ? "(Failure Reason)" : "(Optional)"}
                </Label>
                <Textarea
                  id="resolution-note"
                  placeholder={
                    resolutionAction === "complete"
                      ? "e.g., Payment verified via IntaSend dashboard"
                      : "e.g., User cancelled, timeout, duplicate transaction..."
                  }
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                />
              </div>

              {resolutionAction === "complete" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Warning</p>
                      <p>
                        This will credit KES {Number(selectedTransaction.amount).toLocaleString()}{" "}
                        to the user's wallet. Make sure to verify the payment was actually received
                        before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModalOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveTransaction}
              disabled={resolving || (resolutionAction === "fail" && !resolutionNote)}
              variant={resolutionAction === "complete" ? "default" : "destructive"}
            >
              {resolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : resolutionAction === "complete" ? (
                "Confirm & Credit Wallet"
              ) : (
                "Mark as Failed"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
