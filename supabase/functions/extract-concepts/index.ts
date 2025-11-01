import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, agentType, existingNodes } = await req.json();
    console.log('Extracting concepts from message:', message.substring(0, 50));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a concept extraction expert for mind mapping. Extract 1-3 key concepts from messages and identify parent-child relationships.
            
Existing concepts: ${existingNodes.map((n: any) => n.label).join(', ')}

RULES:
1. If the message ELABORATES on an existing concept, mark it as a child of that concept in "connections"
2. If the message introduces a NEW concept, connections can be empty
3. Return ONLY concepts that are NEW - no duplicates
4. Keep labels concise (2-4 words)

When someone says "for [existing concept]..." or "regarding [existing concept]..." or describes/expands an existing idea, that's elaboration.

Format: Return a JSON object with "concepts" array:
- label: concept name (2-4 words)
- connections: array of parent concept labels this elaborates on

Examples:
Message: "For the rewards program, we need tiered benefits"
→ {"concepts": [{"label": "Tiered Benefits", "connections": ["Rewards Program"]}]}

Message: "What about a mobile app?"
→ {"concepts": [{"label": "Mobile App", "connections": []}]}

Message: "The gamification could include daily challenges"
→ {"concepts": [{"label": "Daily Challenges", "connections": ["Gamification"]}]}`
          },
          { role: 'user', content: message }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_concepts",
            description: "Extract key concepts from a message",
            parameters: {
              type: "object",
              properties: {
                concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      connections: { 
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["label", "connections"]
                  }
                }
              },
              required: ["concepts"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_concepts" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI extraction failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : { concepts: [] };

    console.log('Extracted concepts:', result);

    return new Response(JSON.stringify({ 
      concepts: result.concepts || [],
      agentType 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in extract-concepts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
