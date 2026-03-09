import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Share2, Globe, Settings2, X, Volume2, VolumeX } from "lucide-react";
import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ShareCardSheet from "@/components/ShareCardSheet";
import { useI18n } from "@/lib/i18n";
import { addBookmark, removeBookmarkByRef } from "@/components/BookmarksScreen";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { speakText, stopSpeaking } from "@/lib/audioFeedback";

interface HadithScreenProps {
  onBack: () => void;
  onOpenLanguageSettings?: () => void;
}

interface HadithData {
  hadithNumber: number;
  arabic: string;
  translation: string;
}

interface LinePair {
  arabic: string;
  translation: string;
}

const BOOKS = [
  { key: "bukhari", label: "Sahih Al-Bukhari", arabicLabel: "صحيح البخاري", count: 7563 },
  { key: "muslim", label: "Sahih Muslim", arabicLabel: "صحيح مسلم", count: 3033 },
  { key: "abudawud", label: "Sunan Abu Dawood", arabicLabel: "سنن أبي داود", count: 4590 },
  { key: "tirmidhi", label: "Jami' At-Tirmidhi", arabicLabel: "جامع الترمذي", count: 3956 },
  { key: "nasai", label: "Sunan An-Nasai", arabicLabel: "سنن النسائي", count: 5758 },
  { key: "ibnmajah", label: "Sunan Ibn Majah", arabicLabel: "سنن ابن ماجه", count: 4341 },
];

const CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

// Global cache
const globalCache: Record<string, any[]> = {};

async function fetchEdition(prefix: string, bookKey: string): Promise<any[]> {
  const editionKey = `${prefix}-${bookKey}`;
  if (globalCache[editionKey]) return globalCache[editionKey];

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
    try { localStorage.setItem(lsKey, JSON.stringify(hadiths.slice(0, 500))); } catch {}
    return hadiths;
  } catch {
    return [];
  }
}

// Split hadith into line pairs
function splitHadithIntoLines(arabicText: string, translationText: string): LinePair[] {
  const arabicSentences = arabicText
    .split(/[،؛.؟!]/g)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  const translationSentences = translationText
    .split(/[.;!?]/g)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  const maxLength = Math.max(arabicSentences.length, translationSentences.length, 1);

  return Array.from({ length: maxLength }, (_, i) => ({
    arabic: arabicSentences[i] || "",
    translation: translationSentences[i] || "",
  })).filter(p => p.arabic || p.translation);
}

const HadithScreen = ({ onBack, onOpenLanguageSettings }: HadithScreenProps) => {
  const { t, isRtl, hadithPrefix, currentLanguage } = useI18n();
  
  // Book & page state
  const [currentBook, setCurrentBook] = useState("bukhari");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hadiths, setHadiths] = useState<HadithData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Animation state
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("left");
  const [showControls, setShowControls] = useState(true);
  
  // Touch handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  
  // UI state
  const [shareHadith, setShareHadith] = useState<{ arabic: string; translation: string; reference: string } | null>(null);
  const [bookmarkedRefs, setBookmarkedRefs] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [showArabic, setShowArabic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const bookInfo = BOOKS.find(b => b.key === currentBook) || BOOKS[0];

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

  // Fetch book data
  const fetchBook = useCallback(async (bookKey: string) => {
    setLoading(true);
    const [trans, ara] = await Promise.all([
      fetchEdition(hadithPrefix, bookKey),
      fetchEdition("ara", bookKey),
    ]);

    const merged: HadithData[] = trans.map((h: any, i: number) => ({
      hadithNumber: h.hadithnumber || i + 1,
      arabic: ara[i]?.text || "",
      translation: h.text || "",
    }));

    setHadiths(merged);
    setLoading(false);
  }, [hadithPrefix]);

  useEffect(() => {
    fetchBook(currentBook);
  }, [currentBook, fetchBook]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipPage("left");
      else if (e.key === "ArrowLeft") flipPage("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, isFlipping, hadiths.length]);

  const flipPage = (direction: "left" | "right") => {
    if (isFlipping) return;
    
    const newIndex = direction === "left" 
      ? Math.min(currentIndex + 1, hadiths.length - 1)
      : Math.max(currentIndex - 1, 0);
    
    if (newIndex === currentIndex) return;

    setIsFlipping(true);
    setFlipDirection(direction);
    
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setTimeout(() => setIsFlipping(false), 100);
    }, 300);
  };

  // Touch handlers
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    
    // Only trigger if horizontal swipe is stronger than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) flipPage("left");
      else flipPage("right");
    }
  };

  const handleTapZone = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 3) flipPage("right");
    else if (x > (width * 2) / 3) flipPage("left");
    else setShowControls(prev => !prev);
  };

  const currentHadith = hadiths[currentIndex];
  const reference = currentHadith 
    ? `${bookInfo.label} #${currentHadith.hadithNumber}` 
    : "";
  const isBookmarked = bookmarkedRefs.has(reference);

  const toggleBookmark = async () => {
    if (!currentHadith) return;
    if (isBookmarked) {
      await removeBookmarkByRef(reference);
      setBookmarkedRefs(prev => { const n = new Set(prev); n.delete(reference); return n; });
      toast.success(t("removeBookmark"));
    } else {
      await addBookmark("hadith", currentHadith.arabic, currentHadith.translation, reference);
      setBookmarkedRefs(prev => new Set(prev).add(reference));
      toast.success(t("bookmark") + " ✓");
    }
  };

  const switchBook = (bookKey: string) => {
    if (bookKey === currentBook) return;
    setIsFlipping(true);
    setFlipDirection("left");
    setTimeout(() => {
      setCurrentBook(bookKey);
      setCurrentIndex(0);
      setTimeout(() => setIsFlipping(false), 100);
    }, 300);
  };

  const linePairs = currentHadith 
    ? splitHadithIntoLines(currentHadith.arabic, currentHadith.translation)
    : [];

  const langBadge = hadithPrefix === "urd" ? "UR" : hadithPrefix === "ara" ? "AR" : "EN";
  const progress = hadiths.length > 0 ? ((currentIndex + 1) / hadiths.length) * 100 : 0;

  return (
    <div 
      className="min-h-screen flex flex-col" 
      style={{ background: "#0A0F0D" }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button 
          onClick={onBack} 
          className="flex items-center justify-center rounded-full w-9 h-9"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <h2 className="text-foreground font-bold text-base">{t("hadithLibrary")}</h2>
        <button
          onClick={onOpenLanguageSettings}
          className="flex items-center gap-1 rounded-full px-2 py-1"
          style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          <Globe size={12} style={{ color: "#C9A84C" }} />
          <span className="font-bold text-xs" style={{ color: "#C9A84C" }}>{langBadge}</span>
        </button>
      </div>

      {/* Book Switcher */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
          {BOOKS.map((book) => (
            <button
              key={book.key}
              onClick={() => switchBook(book.key)}
              className="shrink-0 rounded-xl p-2.5 transition-all"
              style={{
                background: currentBook === book.key ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                border: currentBook === book.key ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.06)",
                minWidth: 100,
              }}
            >
              <p className="font-arabic text-center" style={{ fontSize: 14, color: currentBook === book.key ? "#F0D080" : "rgba(255,255,255,0.5)" }}>
                {book.arabicLabel}
              </p>
              <p className="text-center mt-0.5" style={{ fontSize: 10, color: currentBook === book.key ? "#C9A84C" : "rgba(255,255,255,0.35)" }}>
                {book.count} hadith
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Book Container */}
      <div 
        className="flex-1 mx-3 mb-2 relative overflow-hidden"
        style={{
          background: "#111A14",
          border: "1px solid rgba(201,168,76,0.3)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTapZone}
      >
        {/* Paper texture overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {loading ? (
          <div className="p-5 flex flex-col gap-4">
            <Skeleton className="h-5 w-40 mx-auto" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : currentHadith ? (
          <div 
            className={`h-full flex flex-col transition-all duration-300 ${
              isFlipping 
                ? flipDirection === "left" 
                  ? "animate-page-flip-left" 
                  : "animate-page-flip-right"
                : ""
            }`}
            style={{
              transformStyle: "preserve-3d",
              perspective: 1000,
            }}
          >
            {/* Page Header */}
            <div className="px-4 pt-4 pb-2 text-center border-b" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
              <p className="font-arabic" style={{ fontSize: 16, color: "#C9A84C" }}>
                {bookInfo.arabicLabel}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {bookInfo.label}
              </p>
            </div>

            {/* Hadith Number */}
            <div className="px-4 py-2">
              <p className="font-bold" style={{ fontSize: 12, color: "#C9A84C", letterSpacing: 1 }}>
                HADITH #{currentHadith.hadithNumber}
              </p>
            </div>

            {/* Content - Line Pairs */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-none">
              {linePairs.length > 0 ? (
                linePairs.map((pair, idx) => (
                  <div 
                    key={idx} 
                    className="py-3"
                    style={{ 
                      borderBottom: idx < linePairs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      marginLeft: -16,
                      marginRight: -16,
                      paddingLeft: 16,
                      paddingRight: 16,
                    }}
                  >
                    {showArabic && pair.arabic && (
                      <p 
                        className="font-arabic text-right" 
                        dir="rtl" 
                        style={{ 
                          fontSize, 
                          color: "#F0D080", 
                          lineHeight: 1.9,
                          marginBottom: showTranslation && pair.translation ? 8 : 0,
                        }}
                      >
                        {pair.arabic}
                      </p>
                    )}
                    {showTranslation && pair.translation && (
                      <p 
                        dir={currentLanguage.rtl ? "rtl" : "ltr"}
                        style={{ 
                          fontSize: fontSize - 6, 
                          color: "rgba(255,255,255,0.7)", 
                          lineHeight: 1.6,
                          fontStyle: "italic",
                        }}
                      >
                        {pair.translation}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <>
                  {showArabic && currentHadith.arabic && (
                    <p 
                      className="font-arabic text-right mb-4" 
                      dir="rtl" 
                      style={{ fontSize, color: "#F0D080", lineHeight: 1.9 }}
                    >
                      {currentHadith.arabic}
                    </p>
                  )}
                  {showTranslation && currentHadith.translation && (
                    <p 
                      dir={currentLanguage.rtl ? "rtl" : "ltr"}
                      style={{ fontSize: fontSize - 6, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, fontStyle: "italic" }}
                    >
                      {currentHadith.translation}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Bookmark corner */}
            {isBookmarked && (
              <div 
                className="absolute top-0 right-0 w-0 h-0"
                style={{
                  borderStyle: "solid",
                  borderWidth: "0 40px 40px 0",
                  borderColor: "transparent #C9A84C transparent transparent",
                }}
              />
            )}

            {/* Page Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(); }}
                  className="flex items-center justify-center rounded-full w-8 h-8 transition-all active:scale-90"
                  style={{ background: isBookmarked ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.07)" }}
                >
                  {isBookmarked 
                    ? <BookmarkCheck size={14} style={{ color: "#C9A84C" }} /> 
                    : <Bookmark size={14} className="text-foreground" />
                  }
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShareHadith({ arabic: currentHadith.arabic, translation: currentHadith.translation, reference }); 
                  }}
                  className="flex items-center justify-center rounded-full w-8 h-8 transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <Share2 size={14} className="text-foreground" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSpeaking) {
                      stopSpeaking();
                      setIsSpeaking(false);
                    } else {
                      setIsSpeaking(true);
                      const u = speakText(currentHadith.arabic, "arabic");
                      if (u) {
                        u.onend = () => {
                          // Speak translation after Arabic
                          const u2 = speakText(currentHadith.translation, "english");
                          if (u2) u2.onend = () => setIsSpeaking(false);
                          else setIsSpeaking(false);
                        };
                      } else setIsSpeaking(false);
                    }
                  }}
                  className="flex items-center justify-center rounded-full w-8 h-8 transition-all active:scale-90"
                  style={{ background: isSpeaking ? "rgba(37,165,102,0.25)" : "rgba(255,255,255,0.07)" }}
                >
                  {isSpeaking
                    ? <VolumeX size={14} style={{ color: "#25A566" }} />
                    : <Volume2 size={14} className="text-foreground" />
                  }
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                  className="flex items-center justify-center rounded-full w-8 h-8 transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <Settings2 size={14} className="text-foreground" />
                </button>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {currentIndex + 1} / {hadiths.length}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: "rgba(255,255,255,0.4)" }}>{t("noResults")}</p>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="px-4 pb-3 shrink-0">
        {/* Progress bar */}
        <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: "rgba(201,168,76,0.1)" }}>
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#C9A84C" }}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => flipPage("right")}
            disabled={currentIndex === 0 || isFlipping}
            className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold transition-all disabled:opacity-30"
            style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", fontSize: 13 }}
          >
            <ChevronLeft size={16} />
            {t("back")}
          </button>
          
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            Hadith {currentIndex + 1} / {hadiths.length}
          </p>
          
          <button
            onClick={() => flipPage("left")}
            disabled={currentIndex >= hadiths.length - 1 || isFlipping}
            className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold transition-all disabled:opacity-30"
            style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", fontSize: 13 }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="w-full max-w-md rounded-t-3xl p-5 animate-slide-up"
            style={{ background: "#111A14" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground">Reading Settings</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={20} className="text-foreground" />
              </button>
            </div>

            {/* Font Size */}
            <div className="mb-5">
              <p className="text-sm text-muted-foreground mb-2">Arabic Font Size: {fontSize}px</p>
              <input
                type="range"
                min={16}
                max={32}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between">
                <span className="text-foreground">Show Arabic</span>
                <input 
                  type="checkbox" 
                  checked={showArabic} 
                  onChange={e => setShowArabic(e.target.checked)}
                  className="w-5 h-5 accent-[#C9A84C]"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-foreground">Show Translation</span>
                <input 
                  type="checkbox" 
                  checked={showTranslation} 
                  onChange={e => setShowTranslation(e.target.checked)}
                  className="w-5 h-5 accent-[#C9A84C]"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <ShareCardSheet
        open={!!shareHadith}
        onClose={() => setShareHadith(null)}
        arabic={shareHadith?.arabic || ""}
        translation={shareHadith?.translation || ""}
        reference={shareHadith?.reference || ""}
        type="Hadith"
      />

      {/* Page flip animation styles */}
      <style>{`
        @keyframes page-flip-left {
          0% { transform: rotateY(0deg); opacity: 1; }
          50% { transform: rotateY(-90deg); opacity: 0.5; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        @keyframes page-flip-right {
          0% { transform: rotateY(0deg); opacity: 1; }
          50% { transform: rotateY(90deg); opacity: 0.5; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        .animate-page-flip-left {
          animation: page-flip-left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animate-page-flip-right {
          animation: page-flip-right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default HadithScreen;
