import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, conversationHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get session goal
    const { data: session } = await supabase
      .from('sessions')
      .select('goal')
      .eq('id', sessionId)
      .single();

    // Check if user is asking to share (yes/no response)
    const isYesResponse = /^(yes|yeah|yep|sure|ok|okay|y|share|post)/i.test(userMessage.trim());
    const isNoResponse = /^(no|nah|nope|n|don't|dont)/i.test(userMessage.trim());

    // Find the last facilitator message asking about sharing
    const lastFacilitatorMsg = conversationHistory
      .filter((msg: any) => msg.from_facilitator)
      .slice(-1)[0];

    const isAskingToShare = lastFacilitatorMsg?.content?.toLowerCase().includes('share') &&
                            lastFacilitatorMsg?.content?.toLowerCase().includes('group');

    let systemPrompt = "";
    let shouldShareToGroup = false;

    if (isAskingToShare && isYesResponse) {
      // User said yes to sharing
      shouldShareToGroup = true;
      systemPrompt = `You are the Facilitator in a brainstorming session. The user has agreed to share their idea with the group.

Your job is to:
1. Acknowledge their decision positively
2. Let them know you'll post it anonymously to the group
3. Keep your response brief (1-2 sentences)

${session?.goal ? `Session goal: ${session.goal}` : ""}`;

    } else if (isAskingToShare && isNoResponse) {
      // User said no to sharing
      systemPrompt = `You are the Facilitator in a brainstorming session. The user has decided NOT to share their idea with the group.

Your job is to:
1. Respect their decision
2. Offer to help them refine the idea further if they'd like
3. Be supportive and encouraging
4. Keep your response brief (2-3 sentences)

${session?.goal ? `Session goal: ${session.goal}` : ""}`;

    } else {
      // Initial conversation or further refinement
      systemPrompt = `You are the Facilitator in a brainstorming session. A team member has privately shared an idea with you.

Your job is to:
1. Listen and understand their idea
2. Ask clarifying questions or provide constructive feedback
3. Help them refine the idea
4. After discussing, ASK if they'd like you to share it anonymously with the group
5. Be supportive and encouraging
6. Keep responses concise (2-4 sentences)

${session?.goal ? `Session goal: ${session.goal}` : ""}

Remember: This is a PRIVATE conversation. Only share their idea with the group if they explicitly say yes when you ask.`;
    }

    // Build messages for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.from_facilitator ? "assistant" : "user",
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    console.log("Calling AI for private facilitator conversation");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response from AI");
    }

    // If user agreed to share, post anonymously to group
    if (shouldShareToGroup) {
      // Find the user's original idea from conversation history
      const userIdeas = conversationHistory
        .filter((msg: any) => !msg.from_facilitator)
        .map((msg: any) => msg.content);

      const ideaToShare = userIdeas.slice(-2)[0] || userMessage; // Get the idea before "yes"

      // Post to main chat anonymously
      await supabase.from('messages').insert({
        session_id: sessionId,
        content: ideaToShare,
        agent_type: 'user',
        is_anonymous: true,
      });

      console.log("Shared idea anonymously to group");
    }

    return new Response(
      JSON.stringify({ reply, shared: shouldShareToGroup }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in private-facilitator function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
