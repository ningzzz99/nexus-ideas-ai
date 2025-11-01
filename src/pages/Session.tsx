import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage } from "@/components/brainstorm/ChatMessage";
import { ChatInput } from "@/components/brainstorm/ChatInput";
import { SessionHeader } from "@/components/brainstorm/SessionHeader";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = {
  id: string;
  content: string;
  agent_type: 'spark' | 'probe' | 'facilitator' | 'anchor' | 'user';
  created_at: string;
  is_anonymous: boolean;
};

type Session = {
  id: string;
  title: string;
  goal?: string;
  session_url: string;
  status: string;
};

export default function Session() {
  const { sessionUrl } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
  }, [sessionUrl]);

  useEffect(() => {
    if (!session) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Get session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_url', sessionUrl)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Join session as participant
      await supabase
        .from('session_participants')
        .upsert({ session_id: sessionData.id, user_id: user.id });

      // Load messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionData.id)
        .order('created_at', { ascending: true });

      if (messagesData) setMessages(messagesData as Message[]);

      // Get participant count
      const { count } = await supabase
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionData.id);

      if (count) setParticipantCount(count);

    } catch (error: any) {
      toast({
        title: "Error loading session",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const detectAgent = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('@spark')) return 'spark';
    if (lowerMessage.includes('@probe')) return 'probe';
    if (lowerMessage.includes('@facilitator')) return 'facilitator';
    if (lowerMessage.includes('@anchor')) return 'anchor';
    return null;
  };

  const callAgent = async (agent: string, userMessage: string, conversationHistory: any[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-agent', {
        body: {
          agent,
          message: userMessage,
          conversationHistory: conversationHistory.slice(-10), // Last 10 messages for context
          goal: session?.goal,
        },
      });

      if (error) throw error;

      // Save agent response
      await supabase.from('messages').insert({
        session_id: session!.id,
        content: data.reply,
        agent_type: agent,
      });

    } catch (error: any) {
      console.error('Error calling agent:', error);
      toast({
        title: "Agent error",
        description: "Failed to get response from " + agent,
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!session) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save user message
      await supabase.from('messages').insert({
        session_id: session.id,
        content,
        agent_type: 'user',
        user_id: user.id,
      });

      // Check if user mentioned an agent
      const mentionedAgent = detectAgent(content);
      if (mentionedAgent) {
        // Build conversation history
        const conversationHistory = messages.map((msg) => ({
          role: msg.agent_type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));

        await callAgent(mentionedAgent, content, conversationHistory);
      }

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

  const handleSendDM = async (content: string) => {
    if (!session) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build conversation history
      const conversationHistory = messages.map((msg) => ({
        role: msg.agent_type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Call facilitator to post anonymously
      const { data, error } = await supabase.functions.invoke('chat-agent', {
        body: {
          agent: 'facilitator',
          message: content,
          conversationHistory: conversationHistory.slice(-10),
          goal: session.goal,
          isAnonymous: true,
        },
      });

      if (error) throw error;

      // Save the anonymous message as a user message
      await supabase.from('messages').insert({
        session_id: session.id,
        content: data.reply,
        agent_type: 'user',
        is_anonymous: true,
      });

      toast({
        title: "Idea shared anonymously",
        description: "The Facilitator has posted your idea to the chat.",
      });

    } catch (error: any) {
      toast({
        title: "Error sending DM",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;

    try {
      // Update session status
      await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', session.id);

      toast({ title: "Session ended" });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen">Session not found</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <SessionHeader
        title={session.title}
        goal={session.goal}
        sessionUrl={session.session_url}
        onEndSession={handleEndSession}
        participantCount={participantCount}
        onSendDM={handleSendDM}
        dmDisabled={sending}
      />

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              content={message.content}
              agentType={message.agent_type}
              timestamp={message.created_at}
              isAnonymous={message.is_anonymous}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={handleSendMessage} disabled={sending} />
          <p className="text-xs text-muted-foreground mt-2">
            Mention agents with @spark, @probe, @facilitator, or @anchor
          </p>
        </div>
      </div>
    </div>
  );
}
