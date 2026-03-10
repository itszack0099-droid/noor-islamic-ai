import { useState, useRef, useCallback } from "react";
import { Mic, Square, ChevronLeft, RotateCcw, CheckCircle, BarChart3, Brain, Loader2 } from "lucide-react";
import { startBeep, stopBeep } from "@/lib/audioFeedback";
import { normalizeArabic, levenshtein, groqTranscribe } from "@/lib/arabicUtils";
import { startChunkRecorder, ChunkRecorder } from "@/lib/chunkRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface WordResult {
  expected: string;
  spoken: string;
  status: "correct" | "close" | "wrong";
  distance: number;
}

interface AyahResult {
  ayahNum: number;
  ayahText: string;
  words: WordResult[];
  accuracy: number;
}

interface HifzAIProps {
  surahs: Surah[];
  onBack: () => void;
}

type HifzStage = "setup" | "recording" | "analyzing" | "results";
type HifzSpeed = "speed" | "careful";

const HifzAI = ({ surahs, onBack }: HifzAIProps) => {
  const [stage, setStage] = useState<HifzStage>("setup");
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(7);
  const [mode, setMode] = useState<HifzSpeed>("careful");
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [results, setResults] = useState<AyahResult[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSurah = surahs.find((s) => s.number === selectedSurah);

  const startRecording = useCallback(async () => {
    try {
      startBeep();
      setStage("recording");
      setIsRecording(true);
      setLiveText("");
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      const recorder = await startChunkRecorder(
        async (chunk) => {
          const r = await groqTranscribe(chunk);
          if (!r.lowConfidence && r.text) {
            setLiveText((prev) => (prev ? prev + " " + r.text : r.text));
          }
        },
        async (fullBlob) => {
          stopBeep();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setStage("analyzing");

          const final = await groqTranscribe(fullBlob);
          if (final.lowConfidence || !final.text) {
            toast.error("Audio unclear. Try again in a quieter place 🎙️");
            setStage("setup");
            return;
          }

          await analyzeRecitation(final.text);
        }
      );
      recorderRef.current = recorder;
    } catch {
      toast.error("Microphone access required");
      setStage("setup");
      setIsRecording(false);
    }
  }, [selectedSurah, startAyah, endAyah]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const analyzeRecitation = async (spokenText: string) => {
    try {
      const quranRes = await fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/quran-uthmani`);
      const qData = await quranRes.json();
      const ayaat = qData.data.ayahs.slice(startAyah - 1, endAyah);

      const spokenWords = spokenText.split(/\s+/).filter((w) => w.length > 0);
      let wordPtr = 0;

      const ayahResults: AyahResult[] = ayaat.map((ayah: any, idx: number) => {
        const ayahWords = ayah.text.split(/\s+/).filter((w: string) => w.length > 0);

        const wordResults: WordResult[] = ayahWords.map((expected: string) => {
          const spoken = spokenWords[wordPtr] || "";
          wordPtr++;

          const norm_e = normalizeArabic(expected);
          const norm_s = normalizeArabic(spoken);
          const dist = levenshtein(norm_s, norm_e);

          return {
            expected,
            spoken,
            status: dist <= 1 ? "correct" : dist === 2 ? "close" : "wrong",
            distance: dist,
          };
        });

        const correct = wordResults.filter((w) => w.status === "correct").length;
        return {
          ayahNum: startAyah + idx,
          ayahText: ayah.text,
          words: wordResults,
          accuracy: Math.round((correct / ayahWords.length) * 100),
        };
      });

      const totalCorrect = ayahResults.reduce((sum, a) => sum + a.words.filter((w) => w.status === "correct").length, 0);
      const totalWords = ayahResults.reduce((sum, a) => sum + a.words.length, 0);
      const overall = Math.round((totalCorrect / totalWords) * 100);

      setResults(ayahResults);
      setOverallScore(overall);
      setStage("results");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Failed to analyze recitation");
      setStage("setup");
    }
  };

  const saveProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to save progress");
      return;
    }

    for (const r of results) {
      if (r.accuracy >= 80) {
        await (supabase.from("hifz_progress") as any).upsert({
          user_id: user.id,
          surah_number: selectedSurah,
          ayah_number: r.ayahNum,
          memorized: r.accuracy >= 95,
          peek_count: 0,
          last_practiced_at: new Date().toISOString(),
        }, { onConflict: "user_id,surah_number,ayah_number" });
      }
    }
    toast.success("📊 Progress saved!");
  };

  const repeatWrong = () => {
    const wrongAyahs = results.filter((r) => r.accuracy < 80);
    if (wrongAyahs.length === 0) {
      toast.success("All ayaat are correct! 🎉");
      return;
    }
    setStartAyah(wrongAyahs[0].ayahNum);
    setEndAyah(wrongAyahs[wrongAyahs.length - 1].ayahNum);
    setStage("setup");
    setResults([]);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ========== SETUP ==========
  if (stage === "setup") {
    return (
      <div className="min-h-screen" style={{ background: "#0A0F0D" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)" }}>
          <button onClick={onBack} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>🧠 HifzAI</h2>
          <div style={{ width: 36 }} />
        </div>

        <div className="px-5 py-6 space-y-5">
          {/* Surah selector */}
          <div>
            <label className="block mb-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Select Surah</label>
            <select
              value={selectedSurah}
              onChange={(e) => {
                const num = Number(e.target.value);
                setSelectedSurah(num);
                const s = surahs.find((s) => s.number === num);
                if (s) { setStartAyah(1); setEndAyah(Math.min(7, s.numberOfAyahs)); }
              }}
              className="w-full px-4 py-3 rounded-xl text-foreground"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 14 }}
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number} style={{ background: "#111", color: "#fff" }}>
                  {s.number}. {s.englishName} ({s.numberOfAyahs} ayaat)
                </option>
              ))}
            </select>
          </div>

          {/* Ayah range */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block mb-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>From Ayah</label>
              <input
                type="number"
                min={1}
                max={currentSurah?.numberOfAyahs || 1}
                value={startAyah}
                onChange={(e) => setStartAyah(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 rounded-xl text-foreground"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 14 }}
              />
            </div>
            <div className="flex-1">
              <label className="block mb-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>To Ayah</label>
              <input
                type="number"
                min={startAyah}
                max={currentSurah?.numberOfAyahs || 1}
                value={endAyah}
                onChange={(e) => setEndAyah(Math.min(currentSurah?.numberOfAyahs || 1, Number(e.target.value)))}
                className="w-full px-4 py-3 rounded-xl text-foreground"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 14 }}
              />
            </div>
          </div>

          {/* Mode selector */}
          <div>
            <label className="block mb-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Mode</label>
            <div className="flex gap-2">
              {[
                { key: "speed" as HifzSpeed, label: "⚡ Speed", desc: "Quick check" },
                { key: "careful" as HifzSpeed, label: "🎯 Careful", desc: "Detailed analysis" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className="flex-1 py-3 rounded-xl text-center transition-all"
                  style={{
                    background: mode === m.key ? "rgba(37,165,102,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${mode === m.key ? "rgba(37,165,102,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: mode === m.key ? "#25A566" : "rgba(255,255,255,0.4)",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</p>
                  <p style={{ fontSize: 10, marginTop: 2 }}>{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startRecording}
            className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #25A566, #1A7A4A)",
              color: "#fff",
              fontSize: 16,
              boxShadow: "0 4px 24px rgba(37,165,102,0.4)",
            }}
          >
            <Mic size={22} /> 🎙️ Start HifzAI
          </button>

          <p className="text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Recite {currentSurah?.englishName} Ayah {startAyah}-{endAyah} without stopping
          </p>
        </div>
      </div>
    );
  }

  // ========== RECORDING ==========
  if (stage === "recording") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0A0F0D" }}>
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
          <span style={{ fontSize: 14, color: "#ef4444", fontWeight: 600 }}>Recording</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>{formatTime(recordingTime)}</span>
        </div>

        {/* Wave animation */}
        <div className="flex items-end gap-1 mb-6" style={{ height: 40 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 4,
                background: "#C9A84C",
                animation: `wave-bar ${0.6 + i * 0.1}s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        <p className="text-foreground font-semibold mb-1" style={{ fontSize: 16 }}>
          Recite {currentSurah?.englishName} {startAyah}-{endAyah}
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Don't stop between ayaat!</p>

        {liveText && (
          <div className="mt-6 px-4 py-3 rounded-xl w-full max-w-sm" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 16, color: "#F0D080", lineHeight: 1.7 }}>
              {liveText}
            </p>
          </div>
        )}

        <button
          onClick={stopRecording}
          className="mt-8 flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
          style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontSize: 14 }}
        >
          <Square size={16} /> ⏹ Done
        </button>
      </div>
    );
  }

  // ========== ANALYZING ==========
  if (stage === "analyzing") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0A0F0D" }}>
        <Brain size={48} style={{ color: "#C9A84C" }} className="animate-pulse mb-4" />
        <p className="text-foreground font-bold" style={{ fontSize: 18 }}>🧠 HifzAI analyzing...</p>
        <Loader2 size={24} className="text-foreground animate-spin mt-4" />
      </div>
    );
  }

  // ========== RESULTS ==========
  return (
    <div className="min-h-screen" style={{ background: "#0A0F0D" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)" }}>
        <button onClick={() => setStage("setup")} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>🧠 HifzAI Results</h2>
        <div style={{ width: 36 }} />
      </div>

      {/* Overall score */}
      <div className="px-5 py-6 text-center">
        <p style={{
          fontSize: 56,
          fontWeight: 800,
          color: overallScore >= 90 ? "#4ADE80" : overallScore >= 70 ? "#C9A84C" : "#F87171",
        }}>
          {overallScore}%
        </p>
        <p className="text-foreground font-semibold" style={{ fontSize: 16 }}>
          {overallScore >= 95
            ? "Masha'Allah! Perfect! 🎉"
            : overallScore >= 80
            ? "Great job! Keep it up ✅"
            : overallScore >= 60
            ? "Good start — review mistakes 📖"
            : "Needs more practice 💪"}
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          {currentSurah?.englishName} · Ayah {startAyah}-{endAyah}
        </p>
      </div>

      {/* Per ayah results */}
      <div className="px-5 space-y-4 pb-6">
        {results.map((r) => (
          <div key={r.ayahNum} className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 13, color: "#C9A84C", fontWeight: 700 }}>Ayah {r.ayahNum}</span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: r.accuracy >= 90 ? "#4ADE80" : r.accuracy >= 70 ? "#C9A84C" : "#F87171",
              }}>
                {r.accuracy}%
              </span>
            </div>

            {/* Words */}
            <div className="flex flex-wrap justify-end gap-1.5" dir="rtl">
              {r.words.map((w, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span
                    className="font-arabic inline-block px-2 py-1 rounded-lg"
                    style={{
                      fontSize: 22,
                      direction: "rtl",
                      ...(w.status === "correct"
                        ? { color: "#4ADE80", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }
                        : w.status === "close"
                        ? { color: "#FCD34D", background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.3)" }
                        : { color: "#F87171", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", textDecoration: "underline wavy #F87171" }),
                    }}
                  >
                    {w.expected}
                  </span>
                  {w.status === "wrong" && w.spoken && (
                    <div className="mt-0.5 text-center">
                      <p style={{ fontSize: 8, color: "#F87171" }}>❌ {w.spoken}</p>
                      <p style={{ fontSize: 8, color: "#4ADE80" }}>✅ {w.expected}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-8 space-y-3">
        {results.some((r) => r.accuracy < 80) && (
          <button onClick={repeatWrong} className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: "rgba(248,113,113,0.15)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)", fontSize: 14 }}>
            <RotateCcw size={16} /> 🔁 Repeat Wrong Ayaat
          </button>
        )}
        {overallScore >= 80 && (
          <button onClick={async () => { await saveProgress(); }} className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)", fontSize: 14 }}>
            <CheckCircle size={16} /> ✅ Mark as Memorized
          </button>
        )}
        <button onClick={saveProgress} className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)", fontSize: 14 }}>
          <BarChart3 size={16} /> 📊 Save Progress
        </button>
      </div>
    </div>
  );
};

export default HifzAI;
