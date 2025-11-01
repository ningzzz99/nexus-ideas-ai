import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send } from "lucide-react";

type PrivateMessage = {
  id: string;
  content: string;
  from_facilitator: boolean;
  created_at: string;
};

interface PrivateFacilitatorChatProps {
  sessionId: string;
  disabled?: boolean;
}

export function PrivateFacilitatorChat({ sessionId, disabled }: PrivateFacilitatorChatProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadPrivateMessages();

    // Subscribe to new private messages
    const channel = supabase
      .channel(`private-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as PrivateMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadPrivateMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setMessages(data);
    } catch (error: any) {
      console.error('Error loading private messages:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save user's private message
      await supabase.from('private_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        content: message.trim(),
        from_facilitator: false,
      });

      // Call facilitator to handle private conversation
      const { data, error } = await supabase.functions.invoke('private-facilitator', {
        body: {
          sessionId,
          userMessage: message.trim(),
          conversationHistory: messages,
        },
      });

      if (error) throw error;

      // Save facilitator's response
      await supabase.from('private_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        content: data.reply,
        from_facilitator: true,
      });

      setMessage("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Private Chat with Facilitator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Private Conversation with Facilitator</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Share an idea privately with the Facilitator. They'll help you refine it and ask if you'd like to share it anonymously with the group.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.from_facilitator
                    ? 'bg-secondary ml-4'
                    : 'bg-primary text-primary-foreground mr-4'
                }`}
              >
                <div className="text-xs font-semibold mb-1">
                  {msg.from_facilitator ? 'Facilitator' : 'You'}
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[60px]"
          />
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
