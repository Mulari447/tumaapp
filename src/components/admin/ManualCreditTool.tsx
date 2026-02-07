import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreditResult {
  success: boolean;
  message: string;
  transaction_id?: string;
  new_balance?: number;
  user?: {
    email: string;
    name: string;
  };
  error?: string;
}

export function ManualCreditTool() {
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreditResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    // Client-side validation
    if (!userEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "User email is required",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    if (numAmount > 150000) {
      toast({
        title: "Validation Error",
        description: "Maximum single credit is KES 150,000",
        variant: "destructive",
      });
      return;
    }

    const code = mpesaCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,12}$/.test(code)) {
      toast({
        title: "Validation Error",
        description: "M-Pesa code should be 8-12 alphanumeric characters (e.g., SJK7ABC123)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manual-credit", {
        body: {
          user_email: userEmail.trim(),
          amount: numAmount,
          mpesa_confirmation_code: code,
          note: note.trim() || null,
        },
      });

      if (error) throw error;

      if (data.success) {
        setResult(data);
        toast({
          title: "Credit Successful",
          description: data.message,
        });
        // Clear form on success
        setUserEmail("");
        setAmount("");
        setMpesaCode("");
        setNote("");
      } else {
        setResult({ success: false, error: data.error, message: data.error });
        toast({
          title: "Credit Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Manual credit error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process credit";
      setResult({ success: false, error: errorMessage, message: errorMessage });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUserEmail("");
    setAmount("");
    setMpesaCode("");
    setNote("");
    setResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Manual Wallet Credit
        </CardTitle>
        <CardDescription>
          Credit a user's wallet manually using their M-Pesa confirmation SMS code.
          Use this for deposits that succeeded on M-Pesa but weren't recorded in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-email">User Email *</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                min="1"
                max="150000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mpesa-code">M-Pesa Confirmation Code *</Label>
            <Input
              id="mpesa-code"
              placeholder="SJK7ABC123 (from user's SMS)"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
              disabled={loading}
              maxLength={12}
              className="font-mono uppercase"
              required
            />
            <p className="text-xs text-muted-foreground">
              The confirmation code from the user's M-Pesa SMS (e.g., "SJK7ABC123 Confirmed...")
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Admin Note (Optional)</Label>
            <Textarea
              id="note"
              placeholder="Reason for manual credit..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-1">
                      <p className="font-medium text-primary">{result.message}</p>
                      {result.user && (
                        <p className="text-sm text-muted-foreground">
                          User: {result.user.name} ({result.user.email})
                        </p>
                      )}
                      {result.new_balance !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          New Balance: KES {result.new_balance.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p>{result.error}</p>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Credit Wallet
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetForm}
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
