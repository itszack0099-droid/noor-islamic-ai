import { useState, useRef, useCallback } from "react";
import { ChevronLeft, Mic, Square, X, BookOpen, RotateCcw, Loader2 } from "lucide-react";
import { startBeep, stopBeep } from "@/lib/audioFeedback";
import { normalizeArabic, groqTranscribe } from "@/lib/arabicUtils";
import { startChunkRecorder, ChunkRecorder } from "@/lib/chunkRecorder";
import { toast } from "sonner";

interface NoorDetectScreenProps {
  onBack: () => void;
  onOpenQuranPage?: (page: number, ayah: number) => void;
}

interface DetectResult {
  surahName: string;
  surahNameArabic: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  juz: number;
  arabic: string;
  translation: string;
  confidence: number;
}

interface LiveWord {
  text: string;
  status: "spoken" | "current" | "upcoming";
}

const NoorDetectScreen = ({ onBack, onOpenQuranPage }: NoorDetectScreenProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveWords, setLiveWords] = useState<LiveWord[]>([]);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surahInfo, setSurahInfo] = useState<{ name: string; arabic: string; ayah: number; parah: number; page: number } | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const autoOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setIsRecording(false);
    setIsAnalyzing(false);
    setLiveText("");
    setLiveWords([]);
    setResult(null);
    setError(null);
    setSurahInfo(null);
    if (autoOpenRef.current) clearTimeout(autoOpenRef.current);
  };

  const identifyText = useCallback(async (arabicText: string) => {
    const clean = normalizeArabic(arabicText);
    if (clean.length < 3) {
      setError("🤔 Could not identify\nRecite more clearly");
      return;
    }

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

        // Get page number
        let pageNum = 1;
        try {
          const pageRes = await fetch(`https://api.quran.com/api/v4/verses/by_key/${match.surah.number}:${match.numberInSurah}`);
          const pageData = await pageRes.json();
          pageNum = pageData.verse?.page_number || Math.ceil(match.number / 15);
        } catch {
          pageNum = Math.ceil(match.number / 15);
        }

        const r: DetectResult = {
          surahName: match.surah?.englishName || "Unknown",
          surahNameArabic: match.surah?.name || "",
          surahNumber: match.surah?.number || 1,
          ayahNumber: match.numberInSurah || 1,
          pageNumber: pageNum,
          juz: Math.ceil(pageNum / 20),
          arabic: match.text,
          translation,
          confidence: 95,
        };
        setResult(r);

        // Auto open in 2.5 seconds
        if (onOpenQuranPage) {
          autoOpenRef.current = setTimeout(() => {
            onOpenQuranPage(r.pageNumber, r.ayahNumber);
          }, 2500);
        }
        return;
      }
    } catch {}

    setError("🤔 Could not identify\nRecite more clearly");
  }, [onOpenQuranPage]);

  const startRecording = useCallback(async () => {
    reset();
    startBeep();
    setIsRecording(true);

    try {
      const recorder = await startChunkRecorder(
        async (chunk) => {
          const r = await groqTranscribe(chunk);
          if (r.text) {
            setLiveText(prev => prev ? prev + " " + r.text : r.text);

            // Try to identify with partial text
            const combined = liveText ? liveText + " " + r.text : r.text;
            const clean = normalizeArabic(combined);
            if (clean.length > 10) {
              try {
                const res = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(clean)}/all/ar`);
                const data = await res.json();
                if (data.data?.matches?.length > 0) {
                  const match = data.data.matches[0];
                  setSurahInfo({
                    name: match.surah?.englishName || "",
                    arabic: match.surah?.name || "",
                    ayah: match.numberInSurah,
                    parah: Math.ceil((match.number || 1) / 300),
                    page: Math.ceil((match.number || 1) / 15),
                  });

                  // Build live word display
                  const verseWords = match.text.split(/\s+/);
                  const spokenWords = combined.split(/\s+/).length;
                  setLiveWords(verseWords.map((w: string, i: number) => ({
                    text: w,
                    status: i < spokenWords ? "spoken" as const : i === spokenWords ? "current" as const : "upcoming" as const,
                  })));
                }
              } catch {}
            }
          }
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
  }, [identifyText, liveText]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const openNow = () => {
    if (autoOpenRef.current) clearTimeout(autoOpenRef.current);
    if (result && onOpenQuranPage) {
      onOpenQuranPage(result.pageNumber, result.ayahNumber);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0F0D" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={() => { reset(); onBack(); }} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#C9A84C" }}>✨ NoorDetect</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Recite any verse — AI identifies instantly</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {result ? (
          /* FOUND RESULT */
          <div className="w-full animate-fade-slide-in">
            <div className="text-center mb-4">
              <p style={{ fontSize: 36 }}>✨</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#C9A84C" }}>Verse Identified! 🎉</p>
            </div>

            <div className="w-full p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full font-semibold" style={{ fontSize: 10, background: "rgba(37,165,102,0.15)", color: "#25A566" }}>📖 Quran</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#F0F4F0" }}>📖 Surah {result.surahName}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Ayah {result.ayahNumber} | Parah {result.juz} | Page {result.pageNumber}</p>

              <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.08)" }} />

              <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 20, color: "#F0D080", lineHeight: 1.8 }}>
                {result.arabic}
              </p>
              <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.08)" }} />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{result.translation}</p>

              <div className="mt-3 flex items-center gap-2">
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Confidence:</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: `${result.confidence}%`, background: "linear-gradient(90deg, #25A566, #C9A84C)" }} />
                </div>
                <span style={{ fontSize: 11, color: "#C9A84C", fontWeight: 600 }}>{result.confidence}%</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={openNow} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold active:scale-95 transition-transform" style={{ background: "#25A566", color: "#fff", fontSize: 13 }}>
                <BookOpen size={16} /> Open in Quran
              </button>
              <button onClick={() => { reset(); startRecording(); }} className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                <RotateCcw size={14} /> Continue
              </button>
            </div>

            <p className="text-center mt-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Opening surah... ✨</p>
          </div>
        ) : (
          /* RECORDING / IDLE */
          <div className="flex flex-col items-center w-full">
            {/* Live Mushaf display area */}
            {surahInfo && (
              <div className="w-full mb-6 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.2)" }}>
                <div className="text-center mb-3">
                  <p className="font-arabic" style={{ fontSize: 18, color: "#C9A84C" }}>{surahInfo.arabic}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Surah {surahInfo.name} | Ayah {surahInfo.ayah} | Parah {surahInfo.parah}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1" dir="rtl" style={{ lineHeight: 2.2 }}>
                  {liveWords.map((w, i) => (
                    <span
                      key={i}
                      className="inline-block font-arabic transition-all duration-200 px-1 rounded"
                      style={{
                        fontSize: 22,
                        color: w.status === "spoken" ? "#F0D080" : w.status === "current" ? "#FFD700" : "rgba(240,208,128,0.3)",
                        filter: w.status === "upcoming" ? "blur(4px)" : "blur(0)",
                        opacity: w.status === "upcoming" ? 0.3 : 1,
                        textShadow: w.status === "current" ? "0 0 20px rgba(255,215,0,0.8)" : "none",
                        transform: w.status === "current" ? "scale(1.15)" : "scale(1)",
                      }}
                    >
                      {w.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!surahInfo && !isRecording && !isAnalyzing && (
              <div className="text-center mb-6">
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Surah: -- | Ayah: --</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Parah: -- | Page: --</p>
              </div>
            )}

            {/* Mic button */}
            <div className="relative mb-6">
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(109,40,217,0.2)", animationDuration: "1.5s" }} />
                  <div className="absolute -inset-4 rounded-full animate-ping" style={{ background: "rgba(109,40,217,0.1)", animationDuration: "2s" }} />
                  <div className="absolute -inset-8 rounded-full animate-ping" style={{ background: "rgba(109,40,217,0.05)", animationDuration: "2.5s" }} />
                </>
              )}
              <button
                onClick={isRecording ? stopRecording : isAnalyzing ? undefined : startRecording}
                disabled={isAnalyzing}
                className="relative z-10 flex items-center justify-center rounded-full transition-all active:scale-95"
                style={{
                  width: 80, height: 80,
                  background: isRecording ? "linear-gradient(135deg, #6D28D9, #4C1D95)" : isAnalyzing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #6D28D9, #4C1D95)",
                  boxShadow: isRecording ? "0 0 40px rgba(109,40,217,0.5)" : "0 0 20px rgba(109,40,217,0.2)",
                }}
              >
                {isAnalyzing ? <Loader2 size={32} className="text-foreground animate-spin" /> : isRecording ? <Square size={28} style={{ color: "#fff" }} /> : <Mic size={32} style={{ color: "#fff" }} />}
              </button>
            </div>

            <p className="font-semibold mb-1" style={{ fontSize: 16, color: "#F0F4F0" }}>
              {isAnalyzing ? "✨ NoorDetect analyzing..." : isRecording ? "🎙️ Reciting..." : "🎙️ Tap to identify"}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              {isAnalyzing ? "Searching Quran..." : isRecording ? "Speak clearly in Arabic" : "Even a few words work"}
            </p>

            {/* Live transcript */}
            {liveText && !surahInfo && (
              <div className="mt-4 px-4 py-3 rounded-xl w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 16, color: "#F0D080", lineHeight: 1.7 }}>
                  {liveText}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 w-full text-center">
                <p style={{ fontSize: 14, color: "#F87171", whiteSpace: "pre-line" }}>{error}</p>
                <button onClick={() => { reset(); startRecording(); }} className="mt-3 flex items-center justify-center gap-2 mx-auto px-6 py-2.5 rounded-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
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

export default NoorDetectScreen;
