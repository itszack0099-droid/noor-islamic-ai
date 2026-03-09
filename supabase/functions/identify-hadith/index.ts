import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ found: false, message: "No text provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an Islamic hadith identification expert. When given Arabic text that may be from a hadith, identify which hadith it is from. You MUST respond using the provided tool.`,
          },
          {
            role: "user",
            content: `Identify which hadith this Arabic text is from: "${text}". Find the exact hadith from the six major collections (Bukhari, Muslim, Abu Dawood, Tirmidhi, Nasai, Ibn Majah). If you cannot identify it, set found to false.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_hadith",
              description: "Return the identified hadith information",
              parameters: {
                type: "object",
                properties: {
                  found: { type: "boolean", description: "Whether the hadith was identified" },
                  book: { type: "string", description: "Name of the hadith book (e.g. Sahih Bukhari)" },
                  hadith_number: { type: "string", description: "Hadith number in the book" },
                  arabic: { type: "string", description: "Full Arabic text of the hadith" },
                  translation: { type: "string", description: "English translation of the hadith" },
                  reference: { type: "string", description: "Full reference (e.g. Sahih Bukhari #123)" },
                  message: { type: "string", description: "Message if not found" },
                },
                required: ["found"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "identify_hadith" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ found: false, message: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ found: false, message: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ found: false, message: "Identification service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ found: false, message: "Could not identify hadith" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("identify-hadith error:", e);
    return new Response(JSON.stringify({ found: false, message: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
