import { ChevronLeft, Volume2, Bookmark, BookmarkCheck, Share2, Loader2, BookOpen, Globe } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import CrossReferenceSheet from "@/components/CrossReferenceSheet";
import ShareCardSheet from "@/components/ShareCardSheet";
import { useI18n } from "@/lib/i18n";
import { addBookmark, removeBookmarkByRef } from "@/components/BookmarksScreen";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HadithScreenProps {
  onBack: () => void;
  onOpenLanguageSettings?: () => void;
}

interface HadithItem {
  book: string;
  bookKey: string;
  hadithNumber: number;
  arabic: string;
  translation: string;
  grading: { label: string; color: string; bg: string };
}

const BOOK_KEYS = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah"] as const;
const BOOK_LABELS: Record<string, string> = {
  bukhari: "Bukhari", muslim: "Muslim", abudawud: "Abu Dawood",
  tirmidhi: "Tirmizi", nasai: "Nasai", ibnmajah: "Ibn Majah",
};

const CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

function getGrading(bookKey: string): HadithItem["grading"] {
  if (bookKey === "bukhari" || bookKey === "muslim") {
    return { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" };
  }
  return { label: "Hasan", color: "#C9A84C", bg: "rgba(201,168,76,0.15)" };
}

// Cache keyed by "{prefix}-{bookKey}" → hadiths[]
const globalCache: Record<string, any[]> = {};

async function fetchEdition(prefix: string, bookKey: string): Promise<any[]> {
  const editionKey = `${prefix}-${bookKey}`;
  if (globalCache[editionKey]) return globalCache[editionKey];

  // Check localStorage
  const lsKey = `hadith_cdn_${editionKey}`;
  const ls = localStorage.getItem(lsKey);
  if (ls) {
    const parsed = JSON.parse(ls);
    globalCache[editionKey] = parsed;
    return parsed;
  }

  try {
    const res = await fetch(`${CDN}/${editionKey}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    const hadiths = data.hadiths || [];
    globalCache[editionKey] = hadiths;
    try { localStorage.setItem(lsKey, JSON.stringify(hadiths.slice(0, 200))); } catch {}
    return hadiths;
  } catch {
    return [];
  }
}

const HadithScreen = ({ onBack, onOpenLanguageSettings }: HadithScreenProps) => {
  const { t, isRtl, lang, hadithPrefix, currentLanguage } = useI18n();
  const [activeBook, setActiveBook] = useState("bukhari");
  const [transData, setTransData] = useState<Record<string, any[]>>({});
  const [araData, setAraData] = useState<Record<string, any[]>>({});
  const [displayCount, setDisplayCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [crossRefHadith, setCrossRefHadith] = useState<{ text: string; reference: string } | null>(null);
  const [shareHadith, setShareHadith] = useState<{ arabic: string; translation: string; reference: string } | null>(null);
  const [bookmarkedRefs, setBookmarkedRefs] = useState<Set<string>>(new Set());
  const lastPrefix = useRef(hadithPrefix);

  // Load bookmarks
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("bookmarks") as any)
        .select("reference").eq("user_id", user.id).eq("type", "hadith");
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
      await addBookmark("hadith", h.arabic, h.translation, ref);
      setBookmarkedRefs(prev => new Set(prev).add(ref));
      toast.success(t("bookmark") + " ✓");
    }
  };

  const fetchBook = useCallback(async (bookKey: string, prefix: string) => {
    const [trans, ara] = await Promise.all([
      fetchEdition(prefix, bookKey),
      fetchEdition("ara", bookKey),
    ]);
    setTransData(prev => ({ ...prev, [bookKey]: trans }));
    setAraData(prev => ({ ...prev, [bookKey]: ara }));
  }, []);

  // Fetch on mount & when language changes
  useEffect(() => {
    const langChanged = lastPrefix.current !== hadithPrefix;
    lastPrefix.current = hadithPrefix;

    if (langChanged) {
      // Clear translation cache for re-fetch
      setTransData({});
      setAraData({});
    }

    setLoading(true);
    if (activeBook === "all") {
      Promise.all(BOOK_KEYS.map(k => fetchBook(k, hadithPrefix))).finally(() => setLoading(false));
    } else {
      fetchBook(activeBook, hadithPrefix).finally(() => setLoading(false));
    }
  }, [hadithPrefix, activeBook, fetchBook]);

  const switchBook = (bookKey: string) => {
    setActiveBook(bookKey);
    setDisplayCount(20);
  };

  const buildItems = (): HadithItem[] => {
    const books = activeBook === "all" ? [...BOOK_KEYS] : [activeBook];
    const all: HadithItem[] = [];

    for (const bk of books) {
      const trans = transData[bk] || [];
      const ara = araData[bk] || [];
      const limit = activeBook === "all" ? 10 : displayCount;
      const slice = trans.slice(0, limit);

      slice.forEach((h: any, i: number) => {
        all.push({
          book: (BOOK_LABELS[bk] || bk).toUpperCase(),
          bookKey: bk,
          hadithNumber: h.hadithnumber || i + 1,
          arabic: ara[i]?.text || "",
          translation: h.text || "",
          grading: getGrading(bk),
        });
      });
    }

    return activeBook === "all" ? all.slice(0, displayCount) : all;
  };

  const displayHadiths = buildItems();

  const handleLoadMore = async () => {
    setLoadingMore(true);
    if (activeBook === "all") {
      const unfetched = BOOK_KEYS.filter(k => !transData[k]?.length);
      await Promise.all(unfetched.map(k => fetchBook(k, hadithPrefix)));
    }
    setDisplayCount(prev => prev + 20);
    setLoadingMore(false);
  };

  const handleAllBooks = async () => {
    setActiveBook("all");
    setDisplayCount(20);
    const unfetched = BOOK_KEYS.filter(k => !transData[k]?.length);
    if (unfetched.length > 0) {
      setLoading(true);
      await Promise.all(unfetched.map(k => fetchBook(k, hadithPrefix)));
      setLoading(false);
    }
  };

  const langBadge = hadithPrefix === "urd" ? "UR" : hadithPrefix === "ara" ? "AR" : "EN";

  const bookChips = [
    { key: "all", label: t("allBooks") },
    ...BOOK_KEYS.map(k => ({ key: k, label: BOOK_LABELS[k] })),
  ];

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div style={{ background: "linear-gradient(160deg, #0F0800, #3D1A00)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("hadithLibrary")}</h2>
          <button
            onClick={onOpenLanguageSettings}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            <Globe size={13} style={{ color: "#C9A84C" }} />
            <span className="font-bold" style={{ fontSize: 11, color: "#C9A84C" }}>{langBadge}</span>
          </button>
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
                  {/* Translation — only show if different from arabic (i.e. not arabic-only mode) */}
                  {h.translation && hadithPrefix !== "ara" && (
                    <p className="px-4 mt-3" dir={currentLanguage.rtl ? "rtl" : "ltr"} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
                      {h.translation}
                    </p>
                  )}
                  {/* If language IS Arabic, the translation IS the arabic text — show only once above */}
                  {hadithPrefix === "ara" && h.translation && !h.arabic && (
                    <p className="font-arabic text-right px-4 mt-3" dir="rtl" style={{ fontSize: 20, color: "#F0D080", lineHeight: 1.9 }}>
                      {h.translation}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2 px-4 py-3 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <button
                      onClick={() => setCrossRefHadith({ text: h.translation || h.arabic, reference: ref })}
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
                      onClick={() => setShareHadith({ arabic: h.arabic, translation: h.translation, reference: ref })}
                      className="flex items-center justify-center rounded-full"
                      style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}
                    >
                      <Share2 size={14} className="text-foreground" />
                    </button>
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
