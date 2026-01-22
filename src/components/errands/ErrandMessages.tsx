import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

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

interface ErrandMessagesProps {
  errandId: string;
  customerId: string;
  runnerId: string | null;
}

export function ErrandMessages({ errandId, customerId, runnerId }: ErrandMessagesProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch messages
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("errand_messages")
      .select(`
        id,
        sender_id,
        message,
        created_at
      `)
      .eq("errand_id", errandId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    // Fetch sender profiles
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

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`errand-messages-${errandId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "errand_messages",
          filter: `errand_id=eq.${errandId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", newMsg.sender_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              sender: profile || { full_name: null, email: "Unknown" }
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [errandId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const { error } = await supabase.from("errand_messages").insert({
      errand_id: errandId,
      sender_id: user.id,
      message: newMessage.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
    } else {
      setNewMessage("");
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const isOwnMessage = (senderId: string) => user?.id === senderId;
  const isCustomerMessage = (senderId: string) => senderId === customerId;

  if (!runnerId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Messages will be available once a runner accepts this errand.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-lg">
      <div className="px-4 py-2 border-b bg-muted/50">
        <h4 className="font-medium text-sm">Messages</h4>
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
                className={`flex items-start gap-2 ${
                  isOwnMessage(msg.sender_id) ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback
                    className={
                      isCustomerMessage(msg.sender_id)
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }
                  >
                    {getInitials(msg.sender?.full_name || null, msg.sender?.email || "")}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[70%] ${
                    isOwnMessage(msg.sender_id) ? "text-right" : ""
                  }`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isOwnMessage(msg.sender_id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
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

      <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
