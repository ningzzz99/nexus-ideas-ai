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
    const { sessionId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get session data
    const { data: session } = await supabase
      .from('sessions')
      .select('title, goal')
      .eq('id', sessionId)
      .single();

    // Get all messages from the session
    const { data: messages } = await supabase
      .from('messages')
      .select('content, agent_type, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      throw new Error("No messages found for this session");
    }

    // Get mindmap nodes
    const { data: mindmapNodes } = await supabase
      .from('mind_map_nodes')
      .select('label, agent_type')
      .eq('session_id', sessionId);

    // Prepare conversation for analysis
    const conversationText = messages.map(m => 
      `[${m.agent_type || 'user'}]: ${m.content}`
    ).join('\n');

    const mindmapText = mindmapNodes?.map(n => n.label).join(', ') || '';

    // Generate structured summary using tool calling
    const summaryPrompt = `Analyze this brainstorming session and extract structured insights.

Session Title: ${session?.title}
Session Goal: ${session?.goal}

Conversation:
${conversationText}

Mindmap Concepts: ${mindmapText}

Provide a comprehensive analysis including:
1. Key insights and findings
2. Main ideas discussed
3. Action items that need to be done`;

    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert facilitator analyzing brainstorming sessions. Extract clear, actionable insights." },
          { role: "user", content: summaryPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_session_summary",
              description: "Extract structured insights from a brainstorming session",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "A comprehensive summary of the session (2-3 paragraphs)"
                  },
                  key_insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 key insights or findings from the discussion"
                  },
                  main_ideas: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-7 main ideas or concepts discussed"
                  },
                  action_items: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 specific actions that need to be taken"
                  }
                },
                required: ["summary", "key_insights", "main_ideas", "action_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_session_summary" } }
      }),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error("AI API error:", summaryResponse.status, errorText);
      throw new Error(`AI API error: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const toolCall = summaryData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    console.log("Extracted summary data:", extractedData);

    // Generate mindmap image using Lovable AI
    const imagePrompt = `Create a clear, professional mind map diagram showing the key concepts from this brainstorming session: "${session?.title}".

Main concepts to include: ${mindmapText}

Style: Clean, modern mind map with a central topic node and branches for each concept. Use a dark background with bright, readable text. Make it visually organized and easy to understand.`;

    console.log("Generating mindmap image...");

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: imagePrompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Image API error:", imageResponse.status, errorText);
      throw new Error(`Image API error: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    console.log("Image generated, URL length:", imageUrl?.length);

    // Save summary to database
    const { data: savedSummary, error: insertError } = await supabase
      .from('session_summaries')
      .insert({
        session_id: sessionId,
        summary_text: extractedData.summary,
        key_insights: extractedData.key_insights,
        main_ideas: extractedData.main_ideas,
        action_items: extractedData.action_items,
        mindmap_image_url: imageUrl
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving summary:", insertError);
      throw insertError;
    }

    console.log("Summary saved successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        summary: savedSummary
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-session-summary function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});