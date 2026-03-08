import { useState, useRef } from "react";
import { ShieldCheck, Loader2, X, Share2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VerifyResult {
  grade: "Sahih" | "Hasan" | "Daif" | "Fabricated" | "Unknown";
  reason: string;
  source: string;
  warning: string | null;
  localMatch?: boolean;
  localRef?: string;
}

const HADITH_BOOKS = [
  { name: "Bukhari", key: "bukhari" },
  { name: "Muslim", key: "muslim" },
  { name: "Abu Dawood", key: "abudawud" },
  { name: "Tirmizi", key: "tirmizi" },
  { name: "Nasai", key: "nasai" },
  { name: "Ibn Majah", key: "ibnmajah" },
];

const gradeConfig: Record<string, { emoji: string; bg: string; border: string; color: string; label: string }> = {
  Sahih: { emoji: "✅", bg: "rgba(37,165,102,0.12)", border: "rgba(37,165,102,0.3)", color: "#25A566", label: "Authentic (Sahih)" },
  Hasan: { emoji: "🟡", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)", color: "#EAB308", label: "Good (Hasan)" },
  Daif: { emoji: "🟠", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", color: "#F97316", label: "Weak (Da'if)" },
  Fabricated: { emoji: "❌", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", color: "#EF4444", label: "Fabricated (Mawdu')" },
  Unknown: { emoji: "❓", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", color: "#94A3B8", label: "Unknown" },
};

const VerifyHadith = () => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const searchLocal = (q: string): VerifyResult | null => {
    const lq = q.toLowerCase().trim();
    if (lq.length < 10) return null;

    for (const book of HADITH_BOOKS) {
      const cached = localStorage.getItem(`hadith_${book.key}_1`);
      if (!cached) continue;
      try {
        const items: any[] = JSON.parse(cached);
        for (const h of items) {
          const eng = (h.english || "").toLowerCase();
          const arb = h.arabic || "";
          // Check for substantial overlap
          if ((eng.length > 20 && lq.includes(eng.substring(0, 40).toLowerCase())) ||
              (eng.length > 20 && eng.includes(lq.substring(0, 40))) ||
              (arb.length > 10 && q.includes(arb.substring(0, 30)))) {
            return {
              grade: "Sahih",
              reason: `This hadith was found in our verified database from ${book.name}.`,
              source: `${book.name} #${h.hadithNumber}`,
              warning: null,
              localMatch: true,
              localRef: `${book.name} Hadith #${h.hadithNumber}`,
            };
          }
        }
      } catch { /* ignore */ }
    }
    return null;
  };

  const handleVerify = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);

    // Check local first
    const localResult = searchLocal(text);
    if (localResult) {
      setResult(localResult);
      setLoading(false);
      return;
    }

    // Fallback to AI
    try {
      const { data, error } = await supabase.functions.invoke("verify-hadith", {
        body: { hadith_text: text },
      });
      if (error) throw error;
      setResult(data as VerifyResult);
    } catch (e) {
      console.error("Verify error:", e);
      setResult({
        grade: "Unknown",
        reason: "Verification failed. Please try again.",
        source: "Error",
        warning: "Could not connect to the verification service.",
      });
    }
    setLoading(false);
  };

  const handleShare = async () => {
    if (!result) return;
    const g = gradeConfig[result.grade] || gradeConfig.Unknown;
    const shareText = `🔍 Hadith Verification Result\n\n${g.emoji} Grade: ${g.label}\n📖 Source: ${result.source}\n📝 ${result.reason}${result.warning ? `\n⚠️ ${result.warning}` : ""}\n\n— Verified with NoorAI`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: "Hadith Verification", text: shareText });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareText);
      // Simple feedback
      alert("Result copied to clipboard!");
    }
  };

  const handleClear = () => {
    setText("");
    setResult(null);
  };

  const g = result ? (gradeConfig[result.grade] || gradeConfig.Unknown) : null;

  return (
    <div className="px-5 pt-2">
      {/* Text area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste any hadith you want to verify..."
          rows={5}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none resize-none p-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        />
        {text && (
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 p-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        )}
      </div>

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={!text.trim() || loading}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all disabled:opacity-40"
        style={{ background: "#25A566", color: "#fff", fontSize: 14 }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            Verify Now
          </>
        )}
      </button>

      {/* Result card */}
      {result && g && (
        <div
          ref={resultRef}
          className="mt-4 p-4 animate-fade-slide-in"
          style={{
            background: g.bg,
            border: `1px solid ${g.border}`,
            borderRadius: 16,
          }}
        >
          {/* Grade header */}
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 24 }}>{g.emoji}</span>
            <span className="font-bold" style={{ fontSize: 16, color: g.color }}>
              {g.label}
            </span>
            {result.localMatch && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{ fontSize: 9, background: "rgba(37,165,102,0.2)", color: "#25A566" }}
              >
                LOCAL MATCH
              </span>
            )}
          </div>

          {/* Source */}
          <div className="mb-2">
            <span className="font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              SOURCE
            </span>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
              📖 {result.source}
            </p>
          </div>

          {/* Reason */}
          <div className="mb-2">
            <span className="font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              ANALYSIS
            </span>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2, lineHeight: 1.5 }}>
              {result.reason}
            </p>
          </div>

          {/* Warning */}
          {result.warning && (
            <div
              className="flex items-start gap-2 mt-3 p-3 rounded-xl"
              style={{
                background: result.grade === "Fabricated" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.1)",
                border: `1px solid ${result.grade === "Fabricated" ? "rgba(239,68,68,0.2)" : "rgba(249,115,22,0.15)"}`,
              }}
            >
              <AlertTriangle size={16} style={{ color: result.grade === "Fabricated" ? "#EF4444" : "#F97316", marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: result.grade === "Fabricated" ? "#FCA5A5" : "#FDBA74", lineHeight: 1.4 }}>
                {result.warning}
              </p>
            </div>
          )}

          {/* Share button */}
          <button
            onClick={handleShare}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13, border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Share2 size={15} />
            Share Result
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center mt-4 pb-4" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>
        AI verification is for guidance only. Always consult qualified scholars for definitive rulings.
      </p>
    </div>
  );
};

export default VerifyHadith;
