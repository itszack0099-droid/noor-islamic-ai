import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("VITE_GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward to Groq Whisper API
    const groqForm = new FormData();
    groqForm.append("file", file, "audio.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("language", "ar");
    groqForm.append("response_format", "verbose_json");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: groqForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq API error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "Transcription failed", text: "", lowConfidence: true, language: "", noSpeechProb: 1 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    const avgLogProb = data.segments?.[0]?.avg_logprob || -0.5;
    const noSpeechProb = data.segments?.[0]?.no_speech_prob || 1;
    const language = data.language || "";

    if (avgLogProb < -0.85) {
      return new Response(
        JSON.stringify({ text: "", lowConfidence: true, language, noSpeechProb }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        text: data.text?.trim() || "",
        lowConfidence: false,
        language,
        noSpeechProb,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("groq-transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", text: "", lowConfidence: true, language: "", noSpeechProb: 1 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
