import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, text, reference } = await req.json();
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("VITE_GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ API key not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (type === "quran_to_hadith") {
      systemPrompt = `You are an Islamic cross-reference scholar. Given a Quran verse, find 2-3 authentic ahadith that relate to this verse's theme or explain it. Respond ONLY with valid JSON array, no other text:
[{
  "arabic": "hadith text in arabic",
  "translation": "english translation",
  "source": "Book name #number",
  "relevance": "brief note on how it relates to the verse"
}]
Be accurate. Only cite authentic (Sahih/Hasan) hadith from major collections. Never fabricate.`;
      userPrompt = `Find 2-3 authentic ahadith related to this Quran verse: ${text} (${reference})`;
    } else {
      systemPrompt = `You are an Islamic cross-reference scholar. Given a hadith, find 1-2 Quran ayaat that relate to this hadith's theme. Respond ONLY with valid JSON array, no other text:
[{
  "arabic": "ayah in arabic",
  "translation": "english translation",
  "reference": "Surah Name Chapter:Verse",
  "relevance": "brief note on how it relates to the hadith"
}]
Be accurate. Use exact Quran references. Never fabricate.`;
      userPrompt = `Find 1-2 Quran ayaat related to this hadith: ${text} (${reference})`;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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

    let results;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      results = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      results = [];
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cross-reference error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
