import { ChevronLeft, Mic, Volume2, Bookmark, BookmarkCheck, Share2, Search, Loader2, BookOpen } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import CrossReferenceSheet from "@/components/CrossReferenceSheet";
import ShareCardSheet from "@/components/ShareCardSheet";
import { useI18n } from "@/lib/i18n";
import { addBookmark, removeBookmarkByRef } from "@/components/BookmarksScreen";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HadithScreenProps {
  onBack: () => void;
}

interface HadithItem {
  book: string;
  bookKey: string;
  hadithNumber: number;
  arabic: string;
  narrator: string;
  english: string;
  grading: { label: string; color: string; bg: string };
  topics: string[];
}

const BOOK_MAP: Record<string, { label: string; apiKey: string }> = {
  "All Books": { label: "All Books", apiKey: "" },
  Bukhari: { label: "Bukhari", apiKey: "bukhari" },
  Muslim: { label: "Muslim", apiKey: "muslim" },
  "Abu Dawood": { label: "Abu Dawood", apiKey: "abudawud" },
  Tirmizi: { label: "Tirmizi", apiKey: "tirmizi" },
  "Nasa'i": { label: "Nasa'i", apiKey: "nasai" },
  "Ibn Majah": { label: "Ibn Majah", apiKey: "ibnmajah" },
};

const bookKeys = Object.keys(BOOK_MAP);
const BASE = "https://hadith-api.vercel.app";

function parseHadith(raw: any, bookName: string, bookKey: string): HadithItem {
  return {
    book: bookName.toUpperCase(),
    bookKey,
    hadithNumber: raw.hadithNumber || raw.id || 0,
    arabic: raw.hadithArabic || raw.arabic || "",
    narrator: raw.narrator || raw.chain || "",
    english: raw.hadithEnglish || raw.english || raw.text || "",
    grading: { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" },
    topics: [],
  };
}

const HadithScreen = ({ onBack }: HadithScreenProps) => {
  const { t, isRtl } = useI18n();
  const [activeBook, setActiveBook] = useState("All Books");
  const [allHadiths, setAllHadiths] = useState<Record<string, HadithItem[]>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [crossRefHadith, setCrossRefHadith] = useState<{ text: string; reference: string } | null>(null);
  const [shareHadith, setShareHadith] = useState<{ arabic: string; translation: string; reference: string } | null>(null);
  const [bookmarkedRefs, setBookmarkedRefs] = useState<Set<string>>(new Set());

  // Load bookmarks
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("bookmarks") as any)
        .select("reference")
        .eq("user_id", user.id)
        .eq("type", "hadith");
      if (data) setBookmarkedRefs(new Set(data.map((b: any) => b.reference)));
    })();
  }, []);

  const toggleBookmark = async (h: HadithItem) => {
    const ref = `${h.book} #${h.hadithNumber}`;
    if (bookmarkedRefs.has(ref)) {
      await removeBookmarkByRef(ref);
      setBookmarkedRefs(prev => { const n = new Set(prev); n.delete(ref); return n; });
      toast.success(t("removeBookmark"));
    } else {
      await addBookmark("hadith", h.arabic, h.english, ref);
      setBookmarkedRefs(prev => new Set(prev).add(ref));
      toast.success(t("bookmark") + " ✓");
    }
  };

  const fetchBook = useCallback(async (bookKey: string, bookName: string, page: number) => {
    try {
      const cacheKey = `hadith_${bookKey}_${page}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as HadithItem[];

      const res = await fetch(`${BASE}/api/hadiths/${bookKey}?page=${page}&limit=20`);
      const data = await res.json();
      const items = (data.hadiths || data.data || data || []).map((h: any) => parseHadith(h, bookName, bookKey));
      localStorage.setItem(cacheKey, JSON.stringify(items));
      return items;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const entries = Object.entries(BOOK_MAP).filter(([k]) => k !== "All Books");
    Promise.all(entries.map(([name, { apiKey }]) => fetchBook(apiKey, name, 1)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, HadithItem[]> = {};
        const pg: Record<string, number> = {};
        entries.forEach(([name, { apiKey }], i) => {
          map[apiKey] = results[i];
          pg[apiKey] = 1;
        });
        setAllHadiths(map);
        setPages(pg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [fetchBook]);

  const displayHadiths = activeBook === "All Books"
    ? Object.values(allHadiths).flat()
    : allHadiths[BOOK_MAP[activeBook]?.apiKey] || [];

  const handleLoadMore = async () => {
    setLoadingMore(true);
    if (activeBook === "All Books") {
      const entries = Object.entries(BOOK_MAP).filter(([k]) => k !== "All Books");
      const results = await Promise.all(
        entries.map(([name, { apiKey }]) => fetchBook(apiKey, name, (pages[apiKey] || 1) + 1))
      );
      setAllHadiths((prev) => {
        const next = { ...prev };
        entries.forEach(([, { apiKey }], i) => {
          next[apiKey] = [...(next[apiKey] || []), ...results[i]];
        });
        return next;
      });
      setPages((prev) => {
        const next = { ...prev };
        entries.forEach(([, { apiKey }]) => { next[apiKey] = (next[apiKey] || 1) + 1; });
        return next;
      });
    } else {
      const apiKey = BOOK_MAP[activeBook].apiKey;
      const nextPage = (pages[apiKey] || 1) + 1;
      const items = await fetchBook(apiKey, activeBook, nextPage);
      setAllHadiths((prev) => ({ ...prev, [apiKey]: [...(prev[apiKey] || []), ...items] }));
      setPages((prev) => ({ ...prev, [apiKey]: nextPage }));
    }
    setLoadingMore(false);
  };

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div style={{ background: "linear-gradient(160deg, #0F0800, #3D1A00)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("hadithLibrary")}</h2>
          <button className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "#C9A84C" }}>
            <Mic size={18} style={{ color: "#0A0F0D" }} />
          </button>
        </div>
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 px-4" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, height: 44 }}>
            <Search size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", flex: 1 }}>{t("searchPlaceholder")}</span>
            <Mic size={16} style={{ color: "#C9A84C" }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none">
        {bookKeys.map((book) => (
          <button
            key={book}
            onClick={() => setActiveBook(book)}
            className="shrink-0 px-4 py-2 rounded-full font-semibold transition-all"
            style={{
              fontSize: 12,
              background: activeBook === book ? "#C9A84C" : "rgba(255,255,255,0.07)",
              color: activeBook === book ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {book === "All Books" ? t("allBooks") : book}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-3.5" style={{ background: "#111A14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 16 }}>
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-3 w-40 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : displayHadiths.map((h, idx) => {
              const ref = `${h.book} #${h.hadithNumber}`;
              const isSaved = bookmarkedRefs.has(ref);
              return (
              <div key={`${h.bookKey}-${h.hadithNumber}-${idx}`} className="mb-3.5 active:scale-[0.98] transition-transform" style={{ background: "#111A14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="font-bold uppercase" style={{ fontSize: 11, color: "#C9A84C", letterSpacing: 1 }}>
                    {h.book} #{h.hadithNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full font-semibold" style={{ fontSize: 10, background: h.grading.bg, color: h.grading.color }}>
                    ✅ {h.grading.label}
                  </span>
                </div>
                {h.arabic && (
                  <p className="font-arabic text-right px-4 mt-2" dir="rtl" style={{ fontSize: 18, color: "#F0D080", lineHeight: 1.8 }}>
                    {h.arabic}
                  </p>
                )}
                {h.narrator && (
                  <p className="px-4 mt-1 italic" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {h.narrator}
                  </p>
                )}
                <p className="px-4 mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
                  {h.english}
                </p>
                <div className="flex items-center justify-between px-4 py-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex gap-1.5">
                    {h.topics.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-full font-semibold" style={{ fontSize: 10, background: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>{t}</span>
                    ))}
                  </div>
                   <div className="flex gap-2">
                     <button
                       onClick={() => setCrossRefHadith({ text: h.english || h.arabic, reference: ref })}
                       className="flex items-center justify-center rounded-full"
                       style={{ width: 28, height: 28, background: "rgba(37,165,102,0.12)" }}
                     >
                       <BookOpen size={14} style={{ color: "#25A566" }} />
                     </button>
                     <button className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}>
                       <Volume2 size={14} className="text-foreground" />
                     </button>
                     <button
                       onClick={() => toggleBookmark(h)}
                       className="flex items-center justify-center rounded-full"
                       style={{ width: 28, height: 28, background: isSaved ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.07)" }}
                     >
                       {isSaved ? <BookmarkCheck size={14} style={{ color: "#C9A84C" }} /> : <Bookmark size={14} className="text-foreground" />}
                     </button>
                     <button
                       onClick={() => setShareHadith({ arabic: h.arabic, translation: h.english, reference: ref })}
                       className="flex items-center justify-center rounded-full"
                       style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}
                     >
                       <Share2 size={14} className="text-foreground" />
                     </button>
                   </div>
                </div>
              </div>
            );
          })}

        {!loading && displayHadiths.length > 0 && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 mt-2"
            style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", fontSize: 13, border: "1px solid rgba(201,168,76,0.2)" }}
          >
            {loadingMore ? <><Loader2 size={16} className="animate-spin" /> Loading…</> : t("loadMoreHadith")}
          </button>
        )}
      </div>

      <CrossReferenceSheet
        open={!!crossRefHadith}
        onClose={() => setCrossRefHadith(null)}
        type="hadith_to_quran"
        text={crossRefHadith?.text || ""}
        reference={crossRefHadith?.reference || ""}
      />

      <ShareCardSheet
        open={!!shareHadith}
        onClose={() => setShareHadith(null)}
        arabic={shareHadith?.arabic || ""}
        translation={shareHadith?.translation || ""}
        reference={shareHadith?.reference || ""}
        type="Hadith"
      />
    </div>
  );
};

export default HadithScreen;
