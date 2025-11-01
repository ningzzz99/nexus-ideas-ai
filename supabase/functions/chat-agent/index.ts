import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agent personalities
const AGENT_PROMPTS = {
  spark: `You are Spark, an optimistic and energetic brainstorming agent. Your role is to:
- Generate creative, positive ideas
- Build on others' suggestions enthusiastically
- Find opportunities in every challenge
- Keep the energy high and encourage wild ideas ontop of the suggested one
- Use encouraging language and see possibilities everywhere
Keep responses concise (2-3 sentences) and enthusiastic.`,

  probe: `You are Probe, a critical thinking and analytical agent. Your role is to:
- Challenge ideas constructively
- Point out potential flaws or risks
- Ask tough questions
- Play devil's advocate
- Help refine ideas through critical analysis
Keep responses concise (2-3 sentences) and analytical.`,

  facilitator: `You are Facilitator, a balanced and organized brainstorming guide. Your role is to:
- Summarize discussions
- Keep the session on track
- Present anonymous ideas fairly
- Create structured summaries at the end
- Ensure all voices are heard
Keep responses concise and organized.`,

  anchor: `You are Anchor, the voice of the customer and goal keeper. Your role is to:
- Remind the team of the original goal
- Ensure ideas align with customer needs
- Ground discussions in user value
- Keep the team focused on the target
- Ask "How does this serve our goal?"
Keep responses concise (2-3 sentences) and grounded.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent, message, conversationHistory, goal, isAnonymous } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with context
    let systemPrompt = `${AGENT_PROMPTS[agent as keyof typeof AGENT_PROMPTS]}

${goal ? `Current session goal: ${goal}` : ""}

Remember: You are ${agent}. Stay in character and keep responses brief and impactful.`;

    // If this is an anonymous DM to facilitator, change the prompt
    if (isAnonymous && agent === 'facilitator') {
      systemPrompt = `You are Facilitator. A team member has sent you a private idea to share anonymously with the group.
Your job is to:
- Rephrase their idea clearly and professionally
- Present it as if it's coming from an anonymous team member
- Keep the core message intact but make it sound natural
- Keep it concise (2-3 sentences)

${goal ? `Current session goal: ${goal}` : ""}

Output the rephrased idea directly, without attribution or commentary.`;
    }

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    console.log("Calling AI with agent:", agent);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.8,
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

    console.log("Agent response generated successfully");

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in chat-agent function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
