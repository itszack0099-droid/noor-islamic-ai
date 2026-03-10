import { useState, useRef, useCallback } from "react";
import { Mic, Square, X, BookOpen, Share2, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { startBeep, stopBeep } from "@/lib/audioFeedback";
import { normalizeArabic, groqTranscribe } from "@/lib/arabicUtils";
import { startChunkRecorder, ChunkRecorder } from "@/lib/chunkRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NoorDetectResult {
  type: "quran" | "hadith";
  arabic: string;
  translation: string;
  reference: string;
  surahNumber?: number;
  ayahNumber?: number;
  confidence?: number;
  book?: string;
}

interface NoorDetectProps {
  open: boolean;
  onClose: () => void;
  onOpenSurah?: (surahNumber: number, ayahNumber: number) => void;
}

const NoorDetect = ({ open, onClose, onOpenSurah }: NoorDetectProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [result, setResult] = useState<NoorDetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoOpenTimer, setAutoOpenTimer] = useState<number | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);

  const reset = () => {
    setIsRecording(false);
    setIsAnalyzing(false);
    setLiveText("");
    setResult(null);
    setError(null);
    if (autoOpenTimer) clearTimeout(autoOpenTimer);
    setAutoOpenTimer(null);
  };

  const identifyText = useCallback(async (arabicText: string) => {
    const clean = normalizeArabic(arabicText);

    // Search Quran
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(clean)}/all/ar`);
      const data = await res.json();

      if (data.data?.matches?.length > 0) {
        const match = data.data.matches[0];
        // Get translation
        let translation = "";
        try {
          const transRes = await fetch(`https://api.alquran.cloud/v1/ayah/${match.number}/en.asad`);
          const transData = await transRes.json();
          translation = transData.data?.text || "";
        } catch {}

        const r: NoorDetectResult = {
          type: "quran",
          arabic: match.text,
          translation,
          reference: `${match.surah?.englishName || "Surah"} ${match.surah?.number}:${match.numberInSurah}`,
          surahNumber: match.surah?.number,
          ayahNumber: match.numberInSurah,
          confidence: 95,
        };
        setResult(r);

        // Auto-open surah in 2 seconds
        if (onOpenSurah && match.surah?.number) {
          const timer = window.setTimeout(() => {
            onOpenSurah(match.surah.number, match.numberInSurah);
            onClose();
          }, 2500);
          setAutoOpenTimer(timer);
        }
        return;
      }
    } catch {}

    // Check Hadith via edge function
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("identify-hadith", {
        body: { text: arabicText },
      });
      if (!fnErr && data?.found) {
        setResult({
          type: "hadith",
          arabic: data.arabic || "",
          translation: data.translation || "",
          reference: data.reference || "Unknown",
          book: data.book,
          confidence: data.confidence ? Math.round(data.confidence * 100) : 80,
        });
        return;
      }
    } catch {}

    setError("Could not identify verse — try reciting more clearly 🎙️");
  }, [onOpenSurah, onClose]);

  const startRecording = useCallback(async () => {
    try {
      reset();
      startBeep();
      setIsRecording(true);

      const recorder = await startChunkRecorder(
        async (chunk) => {
          const r = await groqTranscribe(chunk);
          if (r.text) setLiveText((prev) => (prev ? prev + " " + r.text : r.text));
        },
        async (fullBlob) => {
          stopBeep();
          setIsRecording(false);
          setIsAnalyzing(true);

          const result = await groqTranscribe(fullBlob);
          if (result.lowConfidence || !result.text) {
            setIsAnalyzing(false);
            setError("Could not hear clearly 🎙️\nPlease try again");
            return;
          }

          await identifyText(result.text);
          setIsAnalyzing(false);
        }
      );
      recorderRef.current = recorder;
    } catch {
      toast.error("Microphone access required");
      setIsRecording(false);
    }
  }, [identifyText]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const openNow = () => {
    if (autoOpenTimer) clearTimeout(autoOpenTimer);
    if (result?.surahNumber && onOpenSurah) {
      onOpenSurah(result.surahNumber, result.ayahNumber || 1);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}>
      <button onClick={() => { reset(); onClose(); }} className="absolute top-4 right-4 z-10 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <X size={20} className="text-foreground" />
      </button>

      <div className="w-full max-w-sm px-6 flex flex-col items-center">
        {result ? (
          /* Result Card */
          <div className="w-full animate-fade-slide-in">
            <div className="text-center mb-4">
              <p style={{ fontSize: 36 }}>✨</p>
              <p className="text-foreground font-bold mt-1" style={{ fontSize: 22 }}>
                {result.type === "quran" ? "Found! ✨ NoorDetect" : "Hadith Found!"}
              </p>
            </div>

            <div className="w-full p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.3)" }}>
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full font-semibold uppercase" style={{
                  fontSize: 10,
                  background: result.type === "quran" ? "rgba(37,165,102,0.15)" : "rgba(201,168,76,0.15)",
                  color: result.type === "quran" ? "#25A566" : "#C9A84C",
                }}>
                  {result.type === "quran" ? "📖 Quran" : "📜 Hadith"}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{result.reference}</span>
              </div>

              {/* Arabic */}
              <p className="font-arabic text-right leading-loose mb-3" dir="rtl" style={{ fontSize: 20, color: "#F0D080" }}>
                {result.arabic}
              </p>

              {/* Translation */}
              {result.translation && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {result.translation}
                </p>
              )}

              {/* Confidence bar */}
              {result.confidence && (
                <div className="mt-3 flex items-center gap-2">
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Confidence:</span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${result.confidence}%`, background: "linear-gradient(90deg, #25A566, #C9A84C)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#C9A84C", fontWeight: 600 }}>{result.confidence}%</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              {result.type === "quran" && result.surahNumber && onOpenSurah && (
                <button onClick={openNow} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold" style={{ background: "#25A566", color: "#fff", fontSize: 13 }}>
                  <BookOpen size={16} /> Open Now
                </button>
              )}
              <button
                onClick={() => {
                  const text = `${result.arabic}\n\n${result.translation}\n\n— ${result.reference}\n\nShared via NoorAI`;
                  if (navigator.share) navigator.share({ text }).catch(() => {});
                  else { navigator.clipboard.writeText(text); toast.success("Copied! ✅"); }
                }}
                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}
              >
                <Share2 size={16} /> Share
              </button>
            </div>

            {result.type === "quran" && result.surahNumber && (
              <p className="text-center mt-3" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                Opening surah... ✨
              </p>
            )}

            <button onClick={reset} className="w-full mt-3 py-2.5 text-center rounded-xl font-semibold" style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Identify Another
            </button>
          </div>
        ) : (
          /* Recording / Idle state */
          <div className="flex flex-col items-center">
            {/* Title */}
            <div className="text-center mb-8">
              <p style={{ fontSize: 28, fontWeight: 800 }}>
                <span style={{ color: "#C9A84C" }}>✨ NoorDetect</span>
              </p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                Recite any Ayah or Hadith — AI identifies instantly
              </p>
              <p className="font-arabic mt-1" style={{ fontSize: 16, color: "rgba(201,168,76,0.5)" }}>اكتشف الآية</p>
            </div>

            {/* Mic button with rings */}
            <div className="relative mb-8">
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(37,165,102,0.2)", animationDuration: "1.5s" }} />
                  <div className="absolute -inset-4 rounded-full animate-ping" style={{ background: "rgba(37,165,102,0.1)", animationDuration: "2s" }} />
                  <div className="absolute -inset-8 rounded-full animate-ping" style={{ background: "rgba(37,165,102,0.05)", animationDuration: "2.5s" }} />
                </>
              )}
              <button
                onClick={isRecording ? stopRecording : isAnalyzing ? undefined : startRecording}
                disabled={isAnalyzing}
                className="relative z-10 flex items-center justify-center rounded-full transition-all active:scale-95"
                style={{
                  width: 96,
                  height: 96,
                  background: isRecording
                    ? "linear-gradient(135deg, #25A566, #1A7A4A)"
                    : isAnalyzing
                    ? "rgba(255,255,255,0.1)"
                    : "linear-gradient(135deg, #25A566, #1A7A4A)",
                  boxShadow: isRecording ? "0 0 40px rgba(37,165,102,0.5)" : "0 0 20px rgba(37,165,102,0.2)",
                }}
              >
                {isAnalyzing ? (
                  <Loader2 size={36} className="text-foreground animate-spin" />
                ) : isRecording ? (
                  <Square size={32} style={{ color: "#fff" }} />
                ) : (
                  <Mic size={36} style={{ color: "#fff" }} />
                )}
              </button>
            </div>

            <p className="text-foreground font-semibold mb-1" style={{ fontSize: 18 }}>
              {isAnalyzing ? "✨ NoorDetect analyzing..." : isRecording ? "🎙️ Listening..." : "Tap to recite"}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              {isAnalyzing ? "Searching Quran & Hadith" : isRecording ? "Speak clearly in Arabic" : "Even a few words work"}
            </p>

            {/* Live transcript */}
            {liveText && (
              <div className="mt-4 px-4 py-3 rounded-xl w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="font-arabic text-right text-foreground" dir="rtl" style={{ fontSize: 16, lineHeight: 1.7 }}>
                  {liveText}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 w-full text-center">
                <p style={{ fontSize: 14, color: "#F87171", whiteSpace: "pre-line" }}>{error}</p>
                <button onClick={startRecording} className="mt-3 flex items-center justify-center gap-2 mx-auto px-6 py-2.5 rounded-xl font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
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

export default NoorDetect;
