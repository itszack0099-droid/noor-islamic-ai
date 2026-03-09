import { useState } from "react";
import { X, Loader2, BookOpen, ScrollText } from "lucide-react";

interface CrossRefItem {
  arabic: string;
  translation: string;
  source?: string;
  reference?: string;
  relevance: string;
}

interface CrossReferenceSheetProps {
  open: boolean;
  onClose: () => void;
  type: "quran_to_hadith" | "hadith_to_quran";
  text: string;
  reference: string;
}

const CROSS_REF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cross-reference`;

const CrossReferenceSheet = ({ open, onClose, type, text, reference }: CrossReferenceSheetProps) => {
  const [results, setResults] = useState<CrossRefItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchCrossRefs = async () => {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const resp = await fetch(CROSS_REF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type, text, reference }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  // Auto-fetch on open
  if (open && !fetched && !loading) {
    fetchCrossRefs();
  }

  // Reset when closed
  if (!open && fetched) {
    setResults([]);
    setFetched(false);
    setLoading(false);
  }

  if (!open) return null;

  const isQuranToHadith = type === "quran_to_hadith";
  const title = isQuranToHadith ? "📜 Related Ahadith" : "📖 Related Ayaat";
  const subtitle = isQuranToHadith
    ? `Ahadith related to ${reference}`
    : `Quran ayaat related to ${reference}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />

      {/* Sheet */}
      <div
        className="relative w-full animate-slide-up"
        style={{ maxWidth: 393, maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-t-3xl overflow-hidden"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderBottom: "none",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "hsl(var(--muted-foreground) / 0.3)" }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div>
              <p className="font-bold text-foreground" style={{ fontSize: 16 }}>{title}</p>
              <p className="text-muted-foreground" style={{ fontSize: 11 }}>{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: "hsl(var(--muted))" }}
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 size={28} className="animate-spin" style={{ color: "hsl(var(--accent))" }} />
                <p className="text-muted-foreground text-sm">Finding cross-references…</p>
              </div>
            )}

            {!loading && fetched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-muted-foreground text-sm">No cross-references found.</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="flex flex-col gap-3">
                {results.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl"
                    style={{
                      background: "hsl(var(--muted))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    {/* Source chip */}
                    <div className="flex items-center gap-2 mb-2">
                      {isQuranToHadith ? (
                        <ScrollText size={14} style={{ color: "hsl(var(--accent))" }} />
                      ) : (
                        <BookOpen size={14} style={{ color: "hsl(var(--primary))" }} />
                      )}
                      <span
                        className="px-2.5 py-0.5 rounded-full font-semibold"
                        style={{
                          fontSize: 10,
                          background: isQuranToHadith
                            ? "hsl(var(--accent) / 0.15)"
                            : "hsl(var(--primary) / 0.15)",
                          color: isQuranToHadith
                            ? "hsl(var(--accent))"
                            : "hsl(var(--primary))",
                        }}
                      >
                        {item.source || item.reference}
                      </span>
                    </div>

                    {/* Arabic */}
                    <p
                      className="font-arabic text-right leading-loose"
                      dir="rtl"
                      style={{
                        fontSize: 19,
                        color: isQuranToHadith ? "hsl(var(--accent-light))" : "hsl(var(--accent-light))",
                        lineHeight: 1.9,
                      }}
                    >
                      {item.arabic}
                    </p>

                    {/* Translation */}
                    <p className="mt-2 text-foreground" style={{ fontSize: 13, lineHeight: 1.6 }}>
                      {item.translation}
                    </p>

                    {/* Relevance */}
                    <p className="mt-2 text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.5 }}>
                      💡 {item.relevance}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrossReferenceSheet;
