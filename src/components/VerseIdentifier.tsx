import { useState, useRef, useCallback, useEffect } from "react";
import { X, Mic, Search, Share2, BookOpen, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startBeep, stopBeep } from "@/lib/audioFeedback";

interface IdentifiedVerse {
  type: "quran" | "hadith";
  arabic: string;
  translation: string;
  reference: string;
  surahNumber?: number;
  ayahNumber?: number;
}

interface VerseIdentifierProps {
  open: boolean;
  onClose: () => void;
  mode?: "quran" | "hadith" | "both";
  onOpenInQuran?: (surahNumber: number, ayahNumber: number) => void;
}

const VerseIdentifier = ({ open, onClose, mode = "both", onOpenInQuran }: VerseIdentifierProps) => {
  const [listening, setListening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [result, setResult] = useState<IdentifiedVerse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"quran" | "hadith">(mode === "hadith" ? "hadith" : "quran");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      setListening(false);
      setSearching(false);
      setSpokenText("");
      setResult(null);
      setError(null);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    }
  }, [open]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    setError(null);
    setResult(null);
    setSpokenText("");

    const recognition = new SR();
    recognition.lang = "ar-SA";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setSpokenText(transcript);

      if (e.results[e.results.length - 1].isFinal) {
        setListening(false);
        identifyVerse(transcript);
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Speech error:", e.error);
      setListening(false);
      if (e.error === "no-speech") {
        setError("No speech detected. Please try again.");
      } else {
        setError("Could not capture audio. Please try again.");
      }
    };

    recognition.onend = () => setListening(false);
    setListening(true);
    startBeep();
    recognition.start();
  }, [activeMode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    stopBeep();
    setListening(false);
  }, []);

  const identifyVerse = async (text: string) => {
    if (!text.trim()) {
      setError("No text recognized. Please try again.");
      return;
    }
    setSearching(true);
    setError(null);

    if (activeMode === "quran") {
      await identifyQuranVerse(text);
    } else {
      await identifyHadith(text);
    }
    setSearching(false);
  };

  const identifyQuranVerse = async (text: string) => {
    try {
      // Search using AlQuran cloud API
      const res = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(text)}/all/ar`);
      const data = await res.json();

      if (data.data?.count > 0 && data.data.matches?.length > 0) {
        const match = data.data.matches[0];
        // Fetch English translation
        let translation = "";
        try {
          const transRes = await fetch(`https://api.alquran.cloud/v1/ayah/${match.number}/en.asad`);
          const transData = await transRes.json();
          translation = transData.data?.text || "";
        } catch {}

        setResult({
          type: "quran",
          arabic: match.text,
          translation,
          reference: `${match.surah?.englishName || "Surah"} ${match.surah?.number}:${match.numberInSurah}`,
          surahNumber: match.surah?.number,
          ayahNumber: match.numberInSurah,
        });
      } else {
        setError("Could not identify verse — try reciting more clearly");
      }
    } catch {
      setError("Search failed. Please check your connection and try again.");
    }
  };

  const identifyHadith = async (text: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("identify-hadith", {
        body: { text },
      });
      if (fnError) throw fnError;
      if (data?.found) {
        setResult({
          type: "hadith",
          arabic: data.arabic || "",
          translation: data.translation || "",
          reference: data.reference || "Unknown",
        });
      } else {
        setError(data?.message || "Could not identify hadith — try reciting more clearly");
      }
    } catch {
      setError("Identification failed. Please try again.");
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const text = `${result.arabic}\n\n${result.translation}\n\n— ${result.reference}`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backdropFilter: "blur(20px)", background: "rgba(0,0,0,0.85)" }}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <X size={20} className="text-foreground" />
      </button>

      <div className="w-full max-w-sm px-6 flex flex-col items-center">
        {/* Mode toggle (if both) */}
        {mode === "both" && !result && !searching && (
          <div className="flex gap-2 mb-8 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setActiveMode("quran")}
              className="px-4 py-2 rounded-lg font-semibold transition-all"
              style={{
                fontSize: 13,
                background: activeMode === "quran" ? "hsl(var(--primary))" : "transparent",
                color: activeMode === "quran" ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            >
              📖 Quran
            </button>
            <button
              onClick={() => setActiveMode("hadith")}
              className="px-4 py-2 rounded-lg font-semibold transition-all"
              style={{
                fontSize: 13,
                background: activeMode === "hadith" ? "hsl(var(--accent))" : "transparent",
                color: activeMode === "hadith" ? "hsl(var(--accent-foreground))" : "rgba(255,255,255,0.4)",
              }}
            >
              📜 Hadith
            </button>
          </div>
        )}

        {/* Main content area */}
        {result ? (
          /* ===== Result Card ===== */
          <div className="w-full animate-fade-slide-in">
            <div className="text-center mb-4">
              <p style={{ fontSize: 32 }}>🎉</p>
              <p className="text-foreground font-bold mt-1" style={{ fontSize: 20 }}>Found!</p>
            </div>

            <div className="w-full p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full font-semibold uppercase" style={{
                  fontSize: 10,
                  background: result.type === "quran" ? "rgba(37,165,102,0.15)" : "rgba(201,168,76,0.15)",
                  color: result.type === "quran" ? "hsl(var(--primary))" : "hsl(var(--accent))",
                }}>
                  {result.type}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{result.reference}</span>
              </div>

              {/* Arabic */}
              {result.arabic && (
                <p className="font-arabic text-right leading-loose mb-3" dir="rtl" style={{ fontSize: 20, color: "hsl(var(--accent-light))" }}>
                  {result.arabic}
                </p>
              )}

              {/* Translation */}
              {result.translation && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {result.translation}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              {result.type === "quran" && result.surahNumber && onOpenInQuran && (
                <button
                  onClick={() => { onOpenInQuran(result.surahNumber!, result.ayahNumber!); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                  style={{ background: "hsl(var(--primary))", color: "#fff", fontSize: 13 }}
                >
                  <BookOpen size={16} /> Open in Quran
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13, flex: result.type === "quran" && onOpenInQuran ? "none" : 1, paddingInline: 20 }}
              >
                <Share2 size={16} /> Share
              </button>
            </div>

            <button
              onClick={() => { setResult(null); setError(null); setSpokenText(""); }}
              className="w-full mt-3 py-2.5 text-center rounded-xl font-semibold"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}
            >
              Identify Another
            </button>
          </div>
        ) : (
          /* ===== Listening / Idle State ===== */
          <div className="flex flex-col items-center">
            {/* Animated mic */}
            <div className="relative mb-6">
              {/* Pulsing rings */}
              {listening && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "hsl(var(--primary) / 0.2)", animationDuration: "1.5s" }} />
                  <div className="absolute -inset-4 rounded-full animate-ping" style={{ background: "hsl(var(--primary) / 0.1)", animationDuration: "2s" }} />
                  <div className="absolute -inset-8 rounded-full animate-ping" style={{ background: "hsl(var(--primary) / 0.05)", animationDuration: "2.5s" }} />
                </>
              )}

              <button
                onClick={listening ? stopListening : startListening}
                disabled={searching}
                className="relative z-10 flex items-center justify-center rounded-full transition-all active:scale-95"
                style={{
                  width: 96,
                  height: 96,
                  background: listening
                    ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dark)))"
                    : searching
                    ? "rgba(255,255,255,0.1)"
                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dark)))",
                  boxShadow: listening ? "0 0 40px hsl(var(--primary) / 0.4)" : "0 0 20px hsl(var(--primary) / 0.2)",
                }}
              >
                {searching ? (
                  <Loader2 size={36} className="text-foreground animate-spin" />
                ) : (
                  <Mic size={36} className="text-foreground" />
                )}
              </button>
            </div>

            {/* Text */}
            <p className="text-foreground font-semibold mb-1" style={{ fontSize: 18 }}>
              {searching ? "Identifying..." : listening ? "Listening..." : "Recite any verse..."}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              {searching
                ? `Searching ${activeMode === "quran" ? "Quran" : "Hadith"} database`
                : listening
                ? "Speak clearly in Arabic"
                : "Even a few words work"}
            </p>

            {/* Spoken text preview */}
            {spokenText && (
              <div className="mt-4 px-4 py-3 rounded-xl w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="font-arabic text-right text-foreground" dir="rtl" style={{ fontSize: 16, lineHeight: 1.7 }}>
                  {spokenText}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 w-full text-center">
                <p style={{ fontSize: 14, color: "hsl(var(--destructive))" }}>{error}</p>
                <button
                  onClick={() => { setError(null); startListening(); }}
                  className="mt-3 flex items-center justify-center gap-2 mx-auto px-6 py-2.5 rounded-xl font-semibold"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}
                >
                  <RotateCcw size={14} /> Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerseIdentifier;
