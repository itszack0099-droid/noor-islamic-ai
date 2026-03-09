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
  english: string;
  grading: { label: string; color: string; bg: string };
}

const BOOKS = [
  { key: "bukhari", label: "Bukhari", engEdition: "eng-bukhari", araEdition: "ara-bukhari" },
  { key: "muslim", label: "Muslim", engEdition: "eng-muslim", araEdition: "ara-muslim" },
  { key: "abudawud", label: "Abu Dawood", engEdition: "eng-abudawud", araEdition: "ara-abudawud" },
  { key: "tirmidhi", label: "Tirmizi", engEdition: "eng-tirmidhi", araEdition: "ara-tirmidhi" },
  { key: "nasai", label: "Nasai", engEdition: "eng-nasai", araEdition: "ara-nasai" },
  { key: "ibnmajah", label: "Ibn Majah", engEdition: "eng-ibnmajah", araEdition: "ara-ibnmajah" },
];

const CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

function getGrading(bookKey: string): HadithItem["grading"] {
  if (bookKey === "bukhari" || bookKey === "muslim") {
    return { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" };
  }
  return { label: "Hasan", color: "#C9A84C", bg: "rgba(201,168,76,0.15)" };
}

interface BookCache {
  eng: any[] | null;
  ara: any[] | null;
}

const HadithScreen = ({ onBack }: HadithScreenProps) => {
  const { t, isRtl } = useI18n();
  const [activeBook, setActiveBook] = useState("bukhari");
  const [cache, setCache] = useState<Record<string, BookCache>>({});
  const [displayCount, setDisplayCount] = useState(20);
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

  const fetchBook = useCallback(async (bookKey: string) => {
    // Check if already cached
    if (cache[bookKey]?.eng) return;

    const book = BOOKS.find(b => b.key === bookKey);
    if (!book) return;

    // Check localStorage
    const lsEngKey = `hadith_cdn_${book.engEdition}`;
    const lsAraKey = `hadith_cdn_${book.araEdition}`;
    const lsEng = localStorage.getItem(lsEngKey);
    const lsAra = localStorage.getItem(lsAraKey);

    if (lsEng && lsAra) {
      setCache(prev => ({
        ...prev,
        [bookKey]: { eng: JSON.parse(lsEng), ara: JSON.parse(lsAra) },
      }));
      return;
    }

    // Fetch both editions in parallel
    try {
      const [engRes, araRes] = await Promise.all([
        fetch(`${CDN}/${book.engEdition}.json`),
        fetch(`${CDN}/${book.araEdition}.json`),
      ]);
      const engData = await engRes.json();
      const araData = await araRes.json();

      const engHadiths = engData.hadiths || [];
      const araHadiths = araData.hadiths || [];

      // Store in localStorage (limit to first 200 to avoid storage limits)
      try {
        localStorage.setItem(lsEngKey, JSON.stringify(engHadiths.slice(0, 200)));
        localStorage.setItem(lsAraKey, JSON.stringify(araHadiths.slice(0, 200)));
      } catch { /* storage full, that's ok */ }

      setCache(prev => ({
        ...prev,
        [bookKey]: { eng: engHadiths, ara: araHadiths },
      }));
    } catch (err) {
      console.error(`Failed to fetch ${bookKey}:`, err);
    }
  }, [cache]);

  // Fetch default book on mount
  useEffect(() => {
    setLoading(true);
    fetchBook("bukhari").finally(() => setLoading(false));
  }, []);

  // When switching books
  const switchBook = async (bookKey: string) => {
    setActiveBook(bookKey);
    setDisplayCount(20);
    if (!cache[bookKey]?.eng) {
      setLoading(true);
      await fetchBook(bookKey);
      setLoading(false);
    }
  };

  // Build display items
  const buildItems = (): HadithItem[] => {
    if (activeBook === "all") {
      // Merge first few from each cached book
      const all: HadithItem[] = [];
      for (const book of BOOKS) {
        const bc = cache[book.key];
        if (!bc?.eng) continue;
        const slice = bc.eng.slice(0, 10);
        slice.forEach((h: any, i: number) => {
          const ara = bc.ara?.[i];
          all.push({
            book: book.label.toUpperCase(),
            bookKey: book.key,
            hadithNumber: h.hadithnumber || i + 1,
            arabic: ara?.text || "",
            english: h.text || "",
            grading: getGrading(book.key),
          });
        });
      }
      return all.slice(0, displayCount);
    }

    const bc = cache[activeBook];
    if (!bc?.eng) return [];

    return bc.eng.slice(0, displayCount).map((h: any, i: number) => {
      const ara = bc.ara?.[i];
      const bookInfo = BOOKS.find(b => b.key === activeBook)!;
      return {
        book: bookInfo.label.toUpperCase(),
        bookKey: activeBook,
        hadithNumber: h.hadithnumber || i + 1,
        arabic: ara?.text || "",
        english: h.text || "",
        grading: getGrading(activeBook),
      };
    });
  };

  const displayHadiths = buildItems();

  const handleLoadMore = async () => {
    setLoadingMore(true);
    // If "all" mode, we may need to fetch more books
    if (activeBook === "all") {
      const unfetched = BOOKS.filter(b => !cache[b.key]?.eng);
      await Promise.all(unfetched.map(b => fetchBook(b.key)));
    }
    setDisplayCount(prev => prev + 20);
    setLoadingMore(false);
  };

  const handleAllBooks = async () => {
    setActiveBook("all");
    setDisplayCount(20);
    // Fetch all books that aren't cached yet
    const unfetched = BOOKS.filter(b => !cache[b.key]?.eng);
    if (unfetched.length > 0) {
      setLoading(true);
      await Promise.all(unfetched.map(b => fetchBook(b.key)));
      setLoading(false);
    }
  };

  const bookChips = [
    { key: "all", label: t("allBooks") },
    ...BOOKS.map(b => ({ key: b.key, label: b.label })),
  ];

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div style={{ background: "linear-gradient(160deg, #0F0800, #3D1A00)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("hadithLibrary")}</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      {/* Book Chips */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none">
        {bookChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => chip.key === "all" ? handleAllBooks() : switchBook(chip.key)}
            className="shrink-0 px-4 py-2 rounded-full font-semibold transition-all"
            style={{
              fontSize: 12,
              background: activeBook === chip.key ? "#C9A84C" : "rgba(255,255,255,0.07)",
              color: activeBook === chip.key ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Hadith Cards */}
      <div className="px-4 pb-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-3.5" style={{ background: "#111A14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 16 }}>
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-3 w-40 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </div>
            ))
          : displayHadiths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{t("noResults")}</p>
            </div>
          ) : displayHadiths.map((h, idx) => {
              const ref = `${h.book} #${h.hadithNumber}`;
              const isSaved = bookmarkedRefs.has(ref);
              return (
                <div key={`${h.bookKey}-${h.hadithNumber}-${idx}`} className="mb-3.5" style={{ background: "#111A14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
                  <div className="flex items-center justify-between px-4 pt-4">
                    <span className="font-bold uppercase" style={{ fontSize: 11, color: "#C9A84C", letterSpacing: 1 }}>
                      {h.book} #{h.hadithNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-semibold" style={{ fontSize: 10, background: h.grading.bg, color: h.grading.color }}>
                      ✅ {h.grading.label}
                    </span>
                  </div>
                  {h.arabic && (
                    <p className="font-arabic text-right px-4 mt-3" dir="rtl" style={{ fontSize: 20, color: "#F0D080", lineHeight: 1.9 }}>
                      {h.arabic}
                    </p>
                  )}
                  <p className="px-4 mt-3" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
                    {h.english}
                  </p>
                  <div className="flex items-center justify-end gap-2 px-4 py-3 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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
              );
            })}

        {/* Load More */}
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
