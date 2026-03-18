import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, DollarSign, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: {
    full_name: string | null;
    email: string;
  };
}

interface PriceProposal {
  id: string;
  errand_id: string;
  proposed_by: string;
  amount: number;
  status: string;
  created_at: string;
  responded_at: string | null;
}

interface ErrandMessagesProps {
  errandId: string;
  customerId: string;
  runnerId: string | null;
}

export function ErrandMessages({ errandId, customerId, runnerId }: ErrandMessagesProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposals, setProposals] = useState<PriceProposal[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("errand_messages")
      .select("id, sender_id, message, created_at")
      .eq("errand_id", errandId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    const senderIds = [...new Set(data.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    setMessages(data.map(m => ({
      ...m,
      sender: profileMap.get(m.sender_id) || { full_name: null, email: "Unknown" }
    })));
    setLoading(false);
  };

  const fetchProposals = async () => {
    const { data, error } = await supabase
      .from("price_proposals")
      .select("*")
      .eq("errand_id", errandId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setProposals(data as PriceProposal[]);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchProposals();

    const msgChannel = supabase
      .channel(`errand-messages-${errandId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "errand_messages",
        filter: `errand_id=eq.${errandId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", newMsg.sender_id)
          .single();

        setMessages((prev) => [...prev, {
          ...newMsg,
          sender: profile || { full_name: null, email: "Unknown" }
        }]);
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "price_proposals",
        filter: `errand_id=eq.${errandId}`,
      }, () => {
        fetchProposals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [errandId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, proposals]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const { error } = await supabase.from("errand_messages").insert({
      errand_id: errandId,
      sender_id: user.id,
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const submitPriceProposal = async () => {
    const amount = Number(priceInput);
    if (!amount || amount <= 0 || !user) return;

    setProposing(true);
    const { error } = await supabase.from("price_proposals").insert({
      errand_id: errandId,
      proposed_by: user.id,
      amount,
    } as any);

    if (error) {
      toast({ title: "Error", description: "Failed to send price proposal", variant: "destructive" });
    } else {
      // Also send a system-like message
      await supabase.from("errand_messages").insert({
        errand_id: errandId,
        sender_id: user.id,
        message: `💰 Proposed price: KES ${amount.toLocaleString()}`,
      });
      setPriceInput("");
      setShowPriceInput(false);
      toast({ title: "Price Proposal Sent", description: `Proposed KES ${amount.toLocaleString()}` });
    }
    setProposing(false);
  };

  const respondToProposal = async (proposalId: string, accept: boolean) => {
    setResponding(proposalId);
    const proposal = proposals.find(p => p.id === proposalId);

    const { error } = await supabase
      .from("price_proposals")
      .update({
        status: accept ? "accepted" : "rejected",
        responded_at: new Date().toISOString(),
      } as any)
      .eq("id", proposalId);

    if (error) {
      toast({ title: "Error", description: "Failed to respond", variant: "destructive" });
    } else {
      if (accept && proposal) {
        // Update errand budget with accepted price
        await supabase
          .from("errands")
          .update({ budget: proposal.amount, total_price: proposal.amount })
          .eq("id", errandId);

        await supabase.from("errand_messages").insert({
          errand_id: errandId,
          sender_id: user!.id,
          message: `✅ Accepted price: KES ${proposal.amount.toLocaleString()}`,
        });
      } else {
        await supabase.from("errand_messages").insert({
          errand_id: errandId,
          sender_id: user!.id,
          message: `❌ Rejected price proposal`,
        });
      }
      fetchProposals();
    }
    setResponding(null);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return email.slice(0, 2).toUpperCase();
  };

  const isOwnMessage = (senderId: string) => user?.id === senderId;
  const isCustomerMessage = (senderId: string) => senderId === customerId;

  const latestPendingProposal = proposals.find(p => p.status === "pending");
  const canRespondToProposal = latestPendingProposal && latestPendingProposal.proposed_by !== user?.id;
  const acceptedProposal = proposals.find(p => p.status === "accepted");

  if (!runnerId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Messages will be available once a runner accepts this errand.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[450px] border rounded-lg">
      <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
        <h4 className="font-medium text-sm">Messages</h4>
        {acceptedProposal && (
          <Badge variant="default" className="bg-green-600 text-xs">
            Agreed: KES {acceptedProposal.amount.toLocaleString()}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${isOwnMessage(msg.sender_id) ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={isCustomerMessage(msg.sender_id) ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                    {getInitials(msg.sender?.full_name || null, msg.sender?.email || "")}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[70%] ${isOwnMessage(msg.sender_id) ? "text-right" : ""}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${isOwnMessage(msg.sender_id) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.message}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(msg.created_at), "h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Pending proposal action bar */}
      {canRespondToProposal && latestPendingProposal && (
        <div className="px-3 py-2 border-t bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            💰 Price proposed: <span className="text-primary font-bold">KES {latestPendingProposal.amount.toLocaleString()}</span>
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive h-8"
              onClick={() => respondToProposal(latestPendingProposal.id, false)}
              disabled={responding === latestPendingProposal.id}
            >
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 h-8"
              onClick={() => respondToProposal(latestPendingProposal.id, true)}
              disabled={responding === latestPendingProposal.id}
            >
              {responding === latestPendingProposal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Accept</>}
            </Button>
          </div>
        </div>
      )}

      {/* Price proposal input */}
      {showPriceInput && (
        <div className="px-3 py-2 border-t bg-muted/50 flex gap-2">
          <Input
            type="number"
            placeholder="Enter amount (KES)"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="flex-1"
            min="1"
          />
          <Button size="sm" onClick={submitPriceProposal} disabled={proposing || !priceInput}>
            {proposing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowPriceInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
        {!acceptedProposal && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShowPriceInput(!showPriceInput)}
            title="Propose a price"
          >
            <DollarSign className="h-4 w-4" />
          </Button>
        )}
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
