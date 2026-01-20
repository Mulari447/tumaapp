import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WalletData {
  id: string;
  balance: number;
  escrow_balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  mpesa_reference: string | null;
}

export default function Wallet() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    checkAuthAndLoadWallet();
  }, []);

  const checkAuthAndLoadWallet = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await loadWallet(session.user.id);
    await loadTransactions();
  };

  const loadWallet = async (userId: string) => {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error loading wallet:", error);
      // Wallet might not exist yet for older users
      if (error.code === "PGRST116") {
        setWallet({ id: "", balance: 0, escrow_balance: 0 });
      }
    } else {
      setWallet(data);
    }
    setLoading(false);
  };

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error loading transactions:", error);
    } else {
      setTransactions(data || []);
    }
  };

  const handleDeposit = async () => {
    if (!phoneNumber || !amount) {
      toast({
        title: "Missing fields",
        description: "Please enter phone number and amount",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 10 || numAmount > 150000) {
      toast({
        title: "Invalid amount",
        description: "Amount must be between KES 10 and KES 150,000",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const response = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          phone_number: phoneNumber,
          amount: numAmount,
          description: "Wallet deposit",
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "STK Push Sent",
        description: "Please check your phone and enter your M-Pesa PIN",
      });
      setDepositOpen(false);
      setPhoneNumber("");
      setAmount("");

      // Poll for updates
      setTimeout(() => {
        loadWallet(session.user.id);
        loadTransactions();
      }, 5000);

    } catch (error: any) {
      console.error("Deposit error:", error);
      toast({
        title: "Deposit failed",
        description: error.message || "Failed to initiate deposit",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!phoneNumber || !amount) {
      toast({
        title: "Missing fields",
        description: "Please enter phone number and amount",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 10) {
      toast({
        title: "Invalid amount",
        description: "Minimum withdrawal is KES 10",
        variant: "destructive",
      });
      return;
    }

    if (wallet && numAmount > wallet.balance) {
      toast({
        title: "Insufficient balance",
        description: `Your available balance is KES ${wallet.balance.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const response = await supabase.functions.invoke("mpesa-withdraw", {
        body: {
          phone_number: phoneNumber,
          amount: numAmount,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Withdrawal successful",
        description: `KES ${numAmount.toLocaleString()} sent to ${phoneNumber}`,
      });
      setWithdrawOpen(false);
      setPhoneNumber("");
      setAmount("");
      loadWallet(session.user.id);
      loadTransactions();

    } catch (error: any) {
      console.error("Withdraw error:", error);
      toast({
        title: "Withdrawal failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "errand_release":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "withdrawal":
      case "errand_payment":
      case "commission":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      default:
        return <WalletIcon className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "failed":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Wallet</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                KES {wallet?.balance?.toLocaleString() || "0"}
              </p>
              <p className="text-sm opacity-75 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Escrow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                KES {wallet?.escrow_balance?.toLocaleString() || "0"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Held for active errands</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
            <DialogTrigger asChild>
              <Button className="h-14" variant="outline">
                <ArrowDownLeft className="h-5 w-5 mr-2" />
                Deposit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deposit via M-Pesa</DialogTitle>
                <DialogDescription>
                  Enter your phone number to receive an STK push
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-phone">M-Pesa Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="deposit-phone"
                      placeholder="0712345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount (KES)</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="1000"
                    min="10"
                    max="150000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleDeposit} 
                  disabled={processing} 
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Send STK Push"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button className="h-14" disabled={!wallet || wallet.balance < 10}>
                <ArrowUpRight className="h-5 w-5 mr-2" />
                Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Withdraw to M-Pesa</DialogTitle>
                <DialogDescription>
                  Available: KES {wallet?.balance?.toLocaleString() || "0"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-phone">M-Pesa Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="withdraw-phone"
                      placeholder="0712345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount (KES)</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="1000"
                    min="10"
                    max={wallet?.balance || 0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleWithdraw} 
                  disabled={processing} 
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Withdraw Now"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {tx.type.replace("_", " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tx.description || tx.mpesa_reference || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.type === "deposit" || tx.type === "errand_release" 
                          ? "text-green-600" 
                          : ""
                      }`}>
                        {tx.type === "deposit" || tx.type === "errand_release" ? "+" : "-"}
                        KES {tx.amount.toLocaleString()}
                      </p>
                      <p className={`text-xs capitalize ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
