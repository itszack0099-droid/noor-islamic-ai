import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situation } = await req.json();
    if (!situation?.trim()) {
      return new Response(JSON.stringify({ error: "No situation provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("VITE_GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ API key not configured");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an Islamic dua scholar. Given a user's situation, find 3 relevant duas from the Quran and authentic Hadith. Respond ONLY with valid JSON array, no other text:
[{
  "arabic": "dua in arabic script",
  "transliteration": "roman english transliteration",
  "translation": "english meaning",
  "source": "Quran X:X or Bukhari #XXX etc",
  "when_to_read": "brief note on when to recite"
}]

Be accurate. Only use authentic sources. Never fabricate duas.`
          },
          {
            role: "user",
            content: `Find 3 relevant duas for this situation: ${situation}`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Groq error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let duas;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      duas = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      duas = [];
    }

    return new Response(JSON.stringify({ duas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-duas error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
