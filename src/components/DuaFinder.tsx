import { useState } from "react";
import { Search, Copy, Share2, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Dua {
  arabic: string;
  transliteration: string;
  translation: string;
  source: string;
  when_to_read: string;
}

const FIND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-duas`;

const suggestions = [
  { emoji: "😰", label: "Feeling anxious" },
  { emoji: "📚", label: "Before studying" },
  { emoji: "✈️", label: "Before travel" },
  { emoji: "😷", label: "When sick" },
  { emoji: "💼", label: "Need rizq" },
  { emoji: "😴", label: "Before sleeping" },
];

const BOOKMARKS_KEY = "noorai_dua_bookmarks";

const getBookmarks = (): Dua[] => {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]"); }
  catch { return []; }
};

const DuaFinder = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [bookmarks, setBookmarks] = useState<Dua[]>(getBookmarks);
  const [searched, setSearched] = useState(false);

  const findDuas = async (situation?: string) => {
    const text = (situation || input).trim();
    if (!text || loading) return;
    setLoading(true);
    setSearched(true);
    setDuas([]);

    try {
      const resp = await fetch(FIND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ situation: text }),
      });

      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setDuas(data.duas || []);
    } catch {
      toast.error("Failed to find duas. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = (dua: Dua) => {
    const exists = bookmarks.some((b) => b.arabic === dua.arabic);
    const next = exists ? bookmarks.filter((b) => b.arabic !== dua.arabic) : [...bookmarks, dua];
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    toast.success(exists ? "Removed from bookmarks" : "Saved to bookmarks");
  };

  const isBookmarked = (dua: Dua) => bookmarks.some((b) => b.arabic === dua.arabic);

  const copyDua = (dua: Dua) => {
    const text = `${dua.arabic}\n\n${dua.transliteration}\n\n${dua.translation}\n\nSource: ${dua.source}`;
    navigator.clipboard.writeText(text);
    toast.success("Dua copied!");
  };

  const shareDua = (dua: Dua) => {
    const text = `${dua.arabic}\n\n${dua.transliteration}\n\n${dua.translation}\n\nSource: ${dua.source}\n\n— NoorAI`;
    if (navigator.share) {
      navigator.share({ title: "Dua from NoorAI", text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to share!");
    }
  };

  const isQuranSource = (source: string) => source.toLowerCase().includes("quran") || source.includes(":");

  return (
    <div className="flex flex-col h-full" style={{ background: "hsl(var(--background))" }}>
      {/* Input area */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 px-4"
            style={{
              background: "hsl(var(--muted))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 22,
              height: 48,
            }}
          >
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findDuas()}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Describe your situation…"
              style={{ fontSize: 14 }}
              disabled={loading}
            />
          </div>
          <button
            onClick={() => findDuas()}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center rounded-full shrink-0 disabled:opacity-40"
            style={{
              width: 44,
              height: 44,
              background: "hsl(var(--primary))",
            }}
          >
            {loading ? (
              <Loader2 size={18} className="text-primary-foreground animate-spin" />
            ) : (
              <Search size={18} className="text-primary-foreground" />
            )}
          </button>
        </div>

        {/* Suggestion chips */}
        {!searched && (
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => { setInput(s.label); findDuas(s.label); }}
                className="px-3 py-1.5 rounded-full font-medium transition-all"
                style={{
                  fontSize: 12,
                  background: "hsl(var(--muted))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--accent))",
                }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: "hsl(var(--accent))" }} />
            <p className="text-muted-foreground text-sm">Finding duas for you…</p>
          </div>
        )}

        {!loading && searched && duas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-muted-foreground text-sm">No duas found. Try a different description.</p>
          </div>
        )}

        {!loading && duas.length > 0 && (
          <div className="flex flex-col gap-4 mt-2">
            {duas.map((dua, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {/* Arabic */}
                <p
                  className="font-arabic text-right leading-loose"
                  dir="rtl"
                  style={{
                    fontSize: 22,
                    color: "hsl(var(--accent-light))",
                    lineHeight: 2,
                  }}
                >
                  {dua.arabic}
                </p>

                {/* Transliteration */}
                <p
                  className="mt-3 italic"
                  style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}
                >
                  {dua.transliteration}
                </p>

                {/* Translation */}
                <p
                  className="mt-2"
                  style={{ fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.6 }}
                >
                  {dua.translation}
                </p>

                {/* When to read */}
                {dua.when_to_read && (
                  <p className="mt-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    📖 {dua.when_to_read}
                  </p>
                )}

                {/* Source + Actions */}
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                  <span
                    className="px-2.5 py-1 rounded-full font-semibold"
                    style={{
                      fontSize: 10,
                      background: isQuranSource(dua.source) ? "hsl(var(--primary) / 0.15)" : "hsl(var(--accent) / 0.15)",
                      color: isQuranSource(dua.source) ? "hsl(var(--primary))" : "hsl(var(--accent))",
                    }}
                  >
                    {dua.source}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => copyDua(dua)} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                      <Copy size={14} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => shareDua(dua)} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                      <Share2 size={14} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => toggleBookmark(dua)} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                      {isBookmarked(dua) ? (
                        <BookmarkCheck size={14} style={{ color: "hsl(var(--accent))" }} />
                      ) : (
                        <Bookmark size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
            <span style={{ fontSize: 40 }}>🤲</span>
            <p className="text-center text-sm text-muted-foreground">
              Describe your situation and we'll find<br />relevant duas from Quran & Hadith
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuaFinder;
