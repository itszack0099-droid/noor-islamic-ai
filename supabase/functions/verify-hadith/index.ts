import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hadith_text } = await req.json();
    if (!hadith_text?.trim()) {
      return new Response(JSON.stringify({ error: "No hadith text provided" }), {
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
            content: `You are an Islamic hadith verification scholar. Analyze the given hadith text and determine its authenticity. You must respond ONLY with valid JSON in this exact format, no other text:
{
  "grade": "Sahih" | "Hasan" | "Daif" | "Fabricated" | "Unknown",
  "reason": "brief scholarly explanation of the grading",
  "source": "book name and hadith number if known, or 'Unknown source'",
  "warning": "any important notes or warnings, or null if none"
}

Be accurate and scholarly. If you are unsure, use "Unknown" grade. Never fabricate sources.`
          },
          {
            role: "user",
            content: `Analyze this hadith text and determine if it is authentic:\n\n"${hadith_text}"`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Groq error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI verification failed` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { grade: "Unknown", reason: content, source: "Unknown source", warning: null };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-hadith error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
