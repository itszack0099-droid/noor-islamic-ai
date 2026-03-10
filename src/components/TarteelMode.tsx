import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X } from "lucide-react";
import { startBeep, stopBeep } from "@/lib/audioFeedback";
import { arabicWordMatch, groqTranscribe } from "@/lib/arabicUtils";
import { startChunkRecorder, ChunkRecorder } from "@/lib/chunkRecorder";
import { toast } from "sonner";

interface TarteelModeProps {
  ayahText: string;
  ayahNumber: number;
  surahName: string;
  onComplete: (correct: number, total: number) => void;
  onClose: () => void;
}

interface WordState {
  original: string;
  status: "pending" | "waiting" | "correct" | "wrong";
  spoken?: string;
}

const TarteelMode = ({ ayahText, ayahNumber, surahName, onComplete, onClose }: TarteelModeProps) => {
  const [words, setWords] = useState<WordState[]>([]);
  const [wordPointer, setWordPointer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [completed, setCompleted] = useState(false);
  const recorderRef = useRef<ChunkRecorder | null>(null);

  useEffect(() => {
    const ayahWords = ayahText.split(/\s+/).filter((w) => w.length > 0);
    const initial: WordState[] = ayahWords.map((w, i) => ({
      original: w,
      status: i === 0 ? "waiting" : "pending",
    }));
    setWords(initial);
    setWordPointer(0);
    setCompleted(false);
  }, [ayahText]);

  const processChunk = useCallback(
    async (blob: Blob) => {
      const result = await groqTranscribe(blob);
      if (result.lowConfidence || !result.text) return;

      setLiveText(result.text);
      const spokenWords = result.text.split(/\s+/).filter((w) => w.length > 0);

      setWords((prev) => {
        const next = [...prev];
        let ptr = prev.findIndex((w) => w.status === "waiting");
        if (ptr < 0) return prev;

        for (const spoken of spokenWords) {
          if (ptr >= next.length) break;

          if (arabicWordMatch(spoken, next[ptr].original)) {
            next[ptr] = { ...next[ptr], status: "correct" };
          } else {
            next[ptr] = { ...next[ptr], status: "wrong", spoken };
          }
          ptr++;
          if (ptr < next.length) {
            next[ptr] = { ...next[ptr], status: "waiting" };
          }
        }

        setWordPointer(ptr);

        // Check completion
        if (ptr >= next.length) {
          const correct = next.filter((w) => w.status === "correct").length;
          setTimeout(() => {
            setCompleted(true);
            onComplete(correct, next.length);
          }, 300);
        }

        return next;
      });
    },
    [onComplete]
  );

  const startRecording = useCallback(async () => {
    try {
      startBeep();
      setIsRecording(true);
      setLiveText("");

      const recorder = await startChunkRecorder(
        processChunk,
        async (fullBlob) => {
          stopBeep();
          setIsRecording(false);
          // Final check with full recording
          const final = await groqTranscribe(fullBlob);
          if (final.text) setLiveText(final.text);
        }
      );
      recorderRef.current = recorder;
    } catch (err) {
      toast.error("Microphone access required");
      setIsRecording(false);
    }
  }, [processChunk]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    stopBeep();
    setIsRecording(false);
  }, []);

  const retry = () => {
    const reset: WordState[] = words.map((w, i) => ({
      original: w.original,
      status: i === 0 ? "waiting" : "pending",
    }));
    setWords(reset);
    setWordPointer(0);
    setCompleted(false);
    setLiveText("");
  };

  const correctCount = words.filter((w) => w.status === "correct").length;
  const wrongCount = words.filter((w) => w.status === "wrong").length;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(20px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onClose} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
          <X size={20} className="text-foreground" />
        </button>
        <div className="text-center">
          <p className="text-foreground font-bold" style={{ fontSize: 16 }}>🎙️ Tarteel Mode</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{surahName} · Ayah {ayahNumber}</p>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Word counter */}
      <div className="flex items-center justify-center gap-4 px-5 py-2">
        <span style={{ fontSize: 12, color: "rgba(74,222,128,0.8)" }}>✅ {correctCount}</span>
        <span style={{ fontSize: 12, color: "rgba(248,113,113,0.8)" }}>❌ {wrongCount}</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Word {Math.min(wordPointer + 1, words.length)}/{words.length}</span>
      </div>

      {/* Words display */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap justify-end gap-2" dir="rtl">
          {words.map((w, i) => (
            <div key={i} className="flex flex-col items-center">
              <span
                className="font-arabic inline-block px-2 py-1 rounded-lg transition-all"
                style={{
                  fontSize: 26,
                  direction: "rtl",
                  ...(w.status === "pending"
                    ? { color: "rgba(240,208,128,0.6)", border: "1px solid transparent" }
                    : w.status === "waiting"
                    ? {
                        color: "rgba(201,168,76,1)",
                        border: "1px solid rgba(201,168,76,0.4)",
                        animation: "pulse 1.5s infinite",
                        boxShadow: "0 0 8px rgba(201,168,76,0.3)",
                      }
                    : w.status === "correct"
                    ? {
                        color: "#4ADE80",
                        background: "rgba(74,222,128,0.15)",
                        border: "1px solid rgba(74,222,128,0.3)",
                      }
                    : {
                        color: "#F87171",
                        background: "rgba(248,113,113,0.15)",
                        border: "1px solid rgba(248,113,113,0.3)",
                        textDecoration: "underline wavy #F87171",
                      }),
                }}
              >
                {w.original}
              </span>
              {w.status === "wrong" && w.spoken && (
                <div className="mt-1 text-center">
                  <p style={{ fontSize: 9, color: "#F87171" }}>❌ {w.spoken}</p>
                  <p style={{ fontSize: 9, color: "#4ADE80" }}>✅ {w.original}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live transcript */}
      {liveText && (
        <div className="px-5 py-2">
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
            Hearing: {liveText}
          </p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="px-5 pb-8 pt-3 flex items-center justify-center gap-4">
        {completed ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-foreground font-bold" style={{ fontSize: 18 }}>
              {correctCount === words.length
                ? "Masha'Allah! Perfect! 🎉"
                : correctCount / words.length >= 0.75
                ? "Great recitation! ✅"
                : "Keep practicing 💪"}
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={retry} className="flex-1 py-3 rounded-xl font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                🔁 Retry
              </button>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold" style={{ background: "rgba(37,165,102,0.2)", color: "#25A566", fontSize: 13 }}>
                ✅ Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {isRecording && (
              <div className="flex items-end gap-0.5 mr-3" style={{ height: 24 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 3,
                      background: "#C9A84C",
                      animation: `wave-bar ${0.8 + i * 0.15}s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className="flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{
                width: 64,
                height: 64,
                background: isRecording
                  ? "linear-gradient(135deg, #ef4444, #dc2626)"
                  : "linear-gradient(135deg, #25A566, #1A7A4A)",
                boxShadow: isRecording
                  ? "0 0 30px rgba(239,68,68,0.4)"
                  : "0 0 30px rgba(37,165,102,0.4)",
              }}
            >
              {isRecording ? <Square size={24} style={{ color: "#fff" }} /> : <Mic size={24} style={{ color: "#fff" }} />}
            </button>

            {isRecording && (
              <p className="ml-3" style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                🔴 Recording
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(201,168,76,0); }
        }
      `}</style>
    </div>
  );
};

export default TarteelMode;
