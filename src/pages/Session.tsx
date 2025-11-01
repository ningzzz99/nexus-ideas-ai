import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage } from "@/components/brainstorm/ChatMessage";
import { ChatInput } from "@/components/brainstorm/ChatInput";
import { SessionHeader } from "@/components/brainstorm/SessionHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MindMap } from "@/components/brainstorm/MindMap";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import { PrivateFacilitatorChat } from "@/components/brainstorm/PrivateFacilitatorChat";

type Message = {
  id: string;
  content: string;
  agent_type: 'spark' | 'probe' | 'facilitator' | 'anchor' | 'user';
  created_at: string;
  is_anonymous: boolean;
  user_id?: string;
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
  const [showMindMap, setShowMindMap] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState<Record<string, number>>({});
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

    // Track inactive participants every 10 messages
    if (messages.length > 0 && messages.length % 10 === 0) {
      checkInactiveParticipants();
    }
  }, [messages]);

  const checkInactiveParticipants = async () => {
    if (!session) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id, profiles(display_name)')
        .eq('session_id', session.id);

      if (!participants) return;

      // Count recent user messages (last 10)
      const recentMessages = messages.slice(-10);
      const recentUserIds = new Set(
        recentMessages
          .filter((m) => m.agent_type === 'user' && !m.is_anonymous)
          .map((m) => m.user_id)
          .filter(Boolean)
      );

      // Find inactive participants
      const inactiveParticipants = participants.filter(
        (p) => p.user_id !== user.id && !recentUserIds.has(p.user_id)
      );

      // Have facilitator engage each inactive participant
      for (const participant of inactiveParticipants) {
        const displayName = (participant.profiles as any)?.display_name || 'team member';
        
        await supabase.from('messages').insert({
          session_id: session.id,
          content: `@${displayName} - I'd love to hear your thoughts! What ideas do you have about ${session.goal || 'this topic'}? Any perspectives you'd like to share?`,
          agent_type: 'facilitator',
        });
      }
    } catch (error) {
      console.error('Error checking inactive participants:', error);
    }
  };

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
        .maybeSingle();

      if (sessionError) throw sessionError;
      
      if (!sessionData) {
        toast({
          title: "Session not found",
          description: "This session doesn't exist or the link is invalid.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }
      
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

  const extractConcepts = async (messageContent: string, agentType: string, messageId: string) => {
    try {
      const { data: existingNodes } = await supabase
        .from('mind_map_nodes')
        .select('label')
        .eq('session_id', session!.id);

      const { data, error } = await supabase.functions.invoke('extract-concepts', {
        body: {
          message: messageContent,
          agentType,
          existingNodes: existingNodes || [],
        },
      });

      if (error) throw error;

      if (data.concepts && data.concepts.length > 0) {
        for (const concept of data.concepts) {
          let nodeX = Math.random() * 600;
          let nodeY = Math.random() * 400;

          // If this concept has parent connections, position it near the parent
          if (concept.connections?.length > 0) {
            const { data: parentNodes } = await supabase
              .from('mind_map_nodes')
              .select('x_position, y_position')
              .eq('session_id', session!.id)
              .in('label', concept.connections);

            if (parentNodes && parentNodes.length > 0) {
              // Position near the first parent with some offset
              const parent = parentNodes[0];
              nodeX = parent.x_position + (Math.random() * 200 - 100);
              nodeY = parent.y_position + (Math.random() * 200 - 100);
            }
          }

          const { data: newNode } = await supabase
            .from('mind_map_nodes')
            .insert({
              session_id: session!.id,
              label: concept.label,
              x_position: nodeX,
              y_position: nodeY,
              agent_type: agentType,
              message_id: messageId,
            })
            .select()
            .single();

          if (newNode && concept.connections?.length > 0) {
            const { data: existingNodesForEdges } = await supabase
              .from('mind_map_nodes')
              .select('id, label')
              .eq('session_id', session!.id)
              .in('label', concept.connections);

            if (existingNodesForEdges) {
              for (const targetNode of existingNodesForEdges) {
                await supabase.from('mind_map_edges').insert({
                  session_id: session!.id,
                  source_node_id: targetNode.id,
                  target_node_id: newNode.id,
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error extracting concepts:', error);
    }
  };

  const callAgent = async (agent: string, userMessage: string, conversationHistory: any[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-agent', {
        body: {
          agent,
          message: userMessage,
          conversationHistory: conversationHistory.slice(-10),
          goal: session?.goal,
        },
      });

      if (error) throw error;

      const { data: savedMessage } = await supabase.from('messages').insert({
        session_id: session!.id,
        content: data.reply,
        agent_type: agent,
      }).select().single();

      if (savedMessage) {
        await extractConcepts(data.reply, agent, savedMessage.id);
      }

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
    <div className="flex h-screen bg-background">
      <div className="flex flex-col flex-1">
        <SessionHeader
          title={session.title}
          goal={session.goal}
          sessionUrl={session.session_url}
          onEndSession={handleEndSession}
          participantCount={participantCount}
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
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex gap-2 justify-end">
              <PrivateFacilitatorChat sessionId={session.id} disabled={sending} />
            </div>
            <ChatInput onSend={handleSendMessage} disabled={sending} />
            <p className="text-xs text-muted-foreground mt-2">
              Mention agents with @spark, @probe, @facilitator, or @anchor
            </p>
          </div>
        </div>
      </div>

      {showMindMap && (
        <div className="w-96 border-l flex flex-col">
          <div className="p-4 border-b flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <h3 className="font-semibold">Mind Map</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowMindMap(false)}>
              Close
            </Button>
          </div>
          <div className="flex-1">
            <MindMap 
              sessionId={session.id} 
              sessionGoal={session.goal}
              sessionTitle={session.title}
            />
          </div>
        </div>
      )}

      {!showMindMap && (
        <Button
          className="fixed right-4 bottom-20"
          size="lg"
          onClick={() => setShowMindMap(true)}
        >
          <Brain className="h-5 w-5 mr-2" />
          Show Mind Map
        </Button>
      )}
    </div>
  );
}
