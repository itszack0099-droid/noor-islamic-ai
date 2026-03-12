import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Square, Bookmark, BookmarkCheck, Share2, Eye, EyeOff, Settings, Menu, Loader2, X, RotateCcw, Volume2, Play, Pause } from "lucide-react";
import CrossReferenceSheet from "@/components/CrossReferenceSheet";
import ShareCardSheet from "@/components/ShareCardSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { addBookmark, removeBookmarkByRef } from "@/components/BookmarksScreen";
import { toast } from "sonner";
import { startBeep, stopBeep } from "@/lib/audioFeedback";
import { normalizeArabic, levenshtein, groqTranscribe } from "@/lib/arabicUtils";
import { startChunkRecorder, ChunkRecorder } from "@/lib/chunkRecorder";
import { Slider } from "@/components/ui/slider";

interface QuranScreenProps { onBack: () => void; initialPage?: number; highlightAyah?: number; }

interface PageWord {
  id: number;
  position: number;
  text_uthmani: string;
  char_type_name: string;
  verse_key: string;
  translation?: string;
  transliteration?: string;
}

interface PageVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  words: PageWord[];
  translation?: string;
}

interface PageData {
  verses: PageVerse[];
  meta: { surahName: string; surahArabic: string; juz: number; hizb: number; pageNumber: number; };
}

// Tajweed color map
const TAJWEED_COLORS: Record<string, string> = {
  ghunnah: "#4ADE80",
  madd: "#60A5FA",
  qalqalah: "#F97316",
  idgham: "#A78BFA",
  idgham_ghunnah: "#A78BFA",
  ikhfa: "#FB923C",
  iqlab: "#F472B6",
};

const TAJWEED_LEGEND = [
  { color: "#4ADE80", label: "Ghunnah" },
  { color: "#60A5FA", label: "Madd" },
  { color: "#F97316", label: "Qalqalah" },
  { color: "#A78BFA", label: "Idgham" },
  { color: "#FB923C", label: "Ikhfa" },
  { color: "#F472B6", label: "Iqlab" },
];

const QARIS = [
  { id: "ar.alafasy", name: "Mishary Alafasy" },
  { id: "ar.abdulbasitmurattal", name: "Abdul Basit" },
  { id: "ar.mahmoudkhalil", name: "Mahmoud Khalil" },
  { id: "ar.saadalghamdi", name: "Saad Al-Ghamdi" },
  { id: "ar.minshawi", name: "Mohamed Siddiq" },
  { id: "ar.shaatree", name: "Abu Bakr Shatri" },
  { id: "ar.hanirifai", name: "Hani Rifai" },
  { id: "ar.mahermuaiqly", name: "Maher Al-Muaiqly" },
];

const TOTAL_PAGES = 604;

const QuranScreen = ({ onBack, initialPage, highlightAyah }: QuranScreenProps) => {
  const { t, isRtl } = useI18n();
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("left");
  const [showFlip, setShowFlip] = useState(false);

  // Hifz mode
  const [hifzMode, setHifzMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [wordPointer, setWordPointer] = useState(0);
  const [wordStatuses, setWordStatuses] = useState<Record<number, "correct" | "close" | "wrong">>({});
  const [mistakes, setMistakes] = useState<{ ayah: string; spoken: string; correct: string }[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [liveText, setLiveText] = useState("");
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const [peekingAyah, setPeekingAyah] = useState<string | null>(null);

  // Nazra mode
  const [nazraMode, setNazraMode] = useState(false);
  const [nazraMistakes, setNazraMistakes] = useState<{ type: string; word: string; correct: string; explanation: string }[]>([]);
  const [showNazraMistake, setShowNazraMistake] = useState<{ type: string; word: string; correct: string; explanation: string } | null>(null);

  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAyah, setPlayingAyah] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedQari, setSelectedQari] = useState(() => localStorage.getItem("quran_qari") || "ar.alafasy");

  // Long press for mode selection
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings overlay
  const [showSettings, setShowSettings] = useState(false);
  const [arabicFontSize, setArabicFontSize] = useState(() => Number(localStorage.getItem("quran_arabic_size") || "26"));
  const [transFontSize, setTransFontSize] = useState(() => Number(localStorage.getItem("quran_trans_size") || "12"));
  const [showTranslation, setShowTranslation] = useState(() => localStorage.getItem("quran_show_trans") !== "false");
  const [showTajweed, setShowTajweed] = useState(() => localStorage.getItem("quran_tajweed") !== "false");

  // Bookmarks
  const [bookmarkedRefs, setBookmarkedRefs] = useState<Set<string>>(new Set());

  // Share
  const [shareAyah, setShareAyah] = useState<{ arabic: string; translation: string; reference: string } | null>(null);

  // Word popup
  const [selectedWord, setSelectedWord] = useState<{ word: PageWord; x: number; y: number } | null>(null);

  // Highlight
  const [highlightedAyahKey, setHighlightedAyahKey] = useState<string | null>(null);

  // Swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Flat words for hifz
  const flatWords = useRef<{ text: string; verseKey: string; index: number }[]>([]);

  const qariName = QARIS.find(q => q.id === selectedQari)?.name || "Mishary Alafasy";

  useEffect(() => {
    if (highlightAyah && pageData) {
      const key = pageData.verses.find(v => v.verse_number === highlightAyah)?.verse_key;
      if (key) {
        setHighlightedAyahKey(key);
        setTimeout(() => setHighlightedAyahKey(null), 4000);
      }
    }
  }, [highlightAyah, pageData]);

  // Fetch page data
  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    const cacheKey = `quran_page_${pageNum}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      setPageData(data);
      buildFlatWords(data);
      setLoading(false);
      return;
    }

    try {
      const [versesRes, transRes] = await Promise.all([
        fetch(`https://api.quran.com/api/v4/verses/by_page/${pageNum}?language=en&words=true&word_fields=text_uthmani,char_type_name&word_translation_language=en&per_page=50`),
        fetch(`https://api.quran.com/api/v4/verses/by_page/${pageNum}?language=en&translations=131&per_page=50`),
      ]);
      const versesData = await versesRes.json();
      const transData = await transRes.json();

      const transMap: Record<string, string> = {};
      for (const v of transData.verses || []) {
        const t = v.translations?.[0]?.text || "";
        transMap[v.verse_key] = t.replace(/<[^>]*>/g, "");
      }

      const firstVerse = versesData.verses?.[0];
      const surahNum = firstVerse ? parseInt(firstVerse.verse_key.split(":")[0]) : 1;

      let surahName = "Al-Fatihah";
      let surahArabic = "الفاتحة";
      try {
        const sInfoRes = await fetch(`https://api.quran.com/api/v4/chapters/${surahNum}`);
        const sInfo = await sInfoRes.json();
        surahName = sInfo.chapter?.name_simple || surahName;
        surahArabic = sInfo.chapter?.name_arabic || surahArabic;
      } catch {}

      const verses: PageVerse[] = (versesData.verses || []).map((v: any) => ({
        id: v.id,
        verse_number: parseInt(v.verse_key.split(":")[1]),
        verse_key: v.verse_key,
        text_uthmani: v.text_uthmani,
        words: (v.words || []).map((w: any) => ({
          id: w.id,
          position: w.position,
          text_uthmani: w.text_uthmani,
          char_type_name: w.char_type_name || "word",
          verse_key: v.verse_key,
          translation: w.translation?.text || "",
          transliteration: w.transliteration?.text || "",
        })),
        translation: transMap[v.verse_key] || "",
      }));

      const data: PageData = {
        verses,
        meta: { surahName, surahArabic, juz: Math.ceil(pageNum / 20), hizb: Math.ceil(pageNum / 10), pageNumber: pageNum },
      };
      setPageData(data);
      buildFlatWords(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
    } catch (err) {
      console.error("Failed to fetch page:", err);
      toast.error("Failed to load page");
    }
    setLoading(false);
  }, []);

  const buildFlatWords = (data: PageData) => {
    const words: { text: string; verseKey: string; index: number }[] = [];
    let idx = 0;
    for (const v of data.verses) {
      for (const w of v.words) {
        if (w.char_type_name === "word") {
          words.push({ text: w.text_uthmani, verseKey: w.verse_key, index: idx });
          idx++;
        }
      }
    }
    flatWords.current = words;
  };

  useEffect(() => { fetchPage(currentPage); }, [currentPage, fetchPage]);

  // Load bookmarks
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("bookmarks") as any).select("reference").eq("user_id", user.id).eq("type", "quran");
      if (data) setBookmarkedRefs(new Set(data.map((b: any) => b.reference)));
    })();
  }, [currentPage]);

  // Save settings
  useEffect(() => {
    localStorage.setItem("quran_arabic_size", String(arabicFontSize));
    localStorage.setItem("quran_trans_size", String(transFontSize));
    localStorage.setItem("quran_show_trans", String(showTranslation));
    localStorage.setItem("quran_tajweed", String(showTajweed));
  }, [arabicFontSize, transFontSize, showTranslation, showTajweed]);

  // RTL page flip: swipe RIGHT = next page (forward in Quran), swipe LEFT = prev page
  const flipPage = useCallback((dir: "next" | "prev") => {
    if (isFlipping) return;
    const nextPage = dir === "next" ? currentPage + 1 : currentPage - 1;
    if (nextPage < 1 || nextPage > TOTAL_PAGES) return;
    setFlipDirection(dir === "next" ? "right" : "left");
    setIsFlipping(true);
    setShowFlip(true);
    setTimeout(() => {
      setCurrentPage(nextPage);
      setShowFlip(false);
      setIsFlipping(false);
      setWordPointer(0);
      setWordStatuses({});
      setMistakes([]);
      setShowSummary(false);
      setLiveText("");
    }, 500);
  }, [isFlipping, currentPage]);

  // Touch/swipe — RTL: swipe right = next, swipe left = prev
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 50 && dy < 100) {
      // RTL book: swipe right = next page, swipe left = prev page
      flipPage(dx > 0 ? "next" : "prev");
    }
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipPage("next"); // Right arrow = next (RTL)
      if (e.key === "ArrowLeft") flipPage("prev");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipPage]);

  // Tap zones — RTL: left third = next, right third = prev
  const handleTapZone = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) flipPage("next");
    else if (x > third * 2) flipPage("prev");
    else setShowSettings(prev => !prev);
  };

  const toggleBookmark = async (verse: PageVerse) => {
    const ref = verse.verse_key.replace(":", " ");
    if (bookmarkedRefs.has(ref)) {
      await removeBookmarkByRef(ref);
      setBookmarkedRefs(prev => { const n = new Set(prev); n.delete(ref); return n; });
      toast.success("Bookmark removed");
    } else {
      await addBookmark("quran", verse.text_uthmani, verse.translation || "", ref);
      setBookmarkedRefs(prev => new Set(prev).add(ref));
      toast.success("Bookmarked ✓");
    }
  };

  // === AUDIO PLAYBACK ===
  const playAudio = useCallback(() => {
    if (!pageData || pageData.verses.length === 0) return;
    setIsPlaying(true);
    setPlayingAyah(0);
    playVerseAudio(0);
  }, [pageData, selectedQari]);

  const playVerseAudio = useCallback((idx: number) => {
    if (!pageData || idx >= pageData.verses.length) {
      setIsPlaying(false);
      setPlayingAyah(0);
      return;
    }
    setPlayingAyah(idx);
    const verse = pageData.verses[idx];
    const [surahNum, ayahNum] = verse.verse_key.split(":").map(Number);
    // Calculate absolute ayah number for audio CDN
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${selectedQari}/${getAbsoluteAyahNumber(surahNum, ayahNum)}.mp3`;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => {
      // Try alternate URL format
      toast.error("Audio not available for this qari");
      setIsPlaying(false);
    });
    audio.onended = () => {
      playVerseAudio(idx + 1);
    };
    audio.onerror = () => {
      // Skip to next
      playVerseAudio(idx + 1);
    };
  }, [pageData, selectedQari]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayingAyah(0);
  }, []);

  const playAyahAudio = useCallback((surahNum: number, ayahNum: number) => {
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${selectedQari}/${getAbsoluteAyahNumber(surahNum, ayahNum)}.mp3`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => toast.error("Audio unavailable"));
  }, [selectedQari]);

  // === HIFZ MODE RECORDING ===
  const startHifzRecording = useCallback(async () => {
    if (isRecording) return;
    setWordPointer(0);
    setWordStatuses({});
    setMistakes([]);
    setLiveText("");
    setShowSummary(false);
    startBeep();
    setIsRecording(true);

    try {
      const recorder = await startChunkRecorder(
        async (chunk) => {
          const result = await groqTranscribe(chunk);
          if (result.lowConfidence || !result.text) return;
          const text = result.text.trim();
          if (text.length < 3) return;
          setLiveText(text);

          const spokenWords = text.split(/\s+/).filter(w => w.length > 0);
          spokenWords.forEach(spoken => {
            setWordPointer(prev => {
              const words = flatWords.current;
              if (prev >= words.length) return prev;
              const expected = words[prev];
              const s = normalizeArabic(spoken);
              const e = normalizeArabic(expected.text);
              const dist = levenshtein(s, e);

              if (dist <= 1) {
                setWordStatuses(p => ({ ...p, [prev]: "correct" }));
              } else if (dist === 2) {
                setWordStatuses(p => ({ ...p, [prev]: "close" }));
              } else {
                setWordStatuses(p => ({ ...p, [prev]: "wrong" }));
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                setMistakes(p => [...p, { ayah: expected.verseKey, spoken, correct: expected.text }]);
              }
              return prev + 1;
            });
          });
        },
        async () => {
          stopBeep();
          setIsRecording(false);
          setShowSummary(true);
        }
      );
      recorderRef.current = recorder;
    } catch {
      toast.error("Microphone access required");
      setIsRecording(false);
    }
  }, [isRecording]);

  // === NAZRA MODE RECORDING ===
  const startNazraRecording = useCallback(async () => {
    if (isRecording) return;
    setNazraMode(true);
    setWordPointer(0);
    setWordStatuses({});
    setNazraMistakes([]);
    setLiveText("");
    setShowSummary(false);
    startBeep();
    setIsRecording(true);

    try {
      const recorder = await startChunkRecorder(
        async (chunk) => {
          const result = await groqTranscribe(chunk);
          if (result.lowConfidence || !result.text) return;
          const text = result.text.trim();
          if (text.length < 3) return;
          setLiveText(text);

          // Word matching same as hifz but words are visible
          const spokenWords = text.split(/\s+/).filter(w => w.length > 0);
          spokenWords.forEach(spoken => {
            setWordPointer(prev => {
              const words = flatWords.current;
              if (prev >= words.length) return prev;
              const expected = words[prev];
              const s = normalizeArabic(spoken);
              const e = normalizeArabic(expected.text);
              const dist = levenshtein(s, e);

              if (dist <= 1) {
                setWordStatuses(p => ({ ...p, [prev]: "correct" }));
              } else if (dist === 2) {
                setWordStatuses(p => ({ ...p, [prev]: "close" }));
              } else {
                setWordStatuses(p => ({ ...p, [prev]: "wrong" }));
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                // Show tajweed mistake
                setShowNazraMistake({
                  type: "Wrong Word",
                  word: spoken,
                  correct: expected.text,
                  explanation: `Expected "${expected.text}" but heard "${spoken}"`,
                });
              }
              return prev + 1;
            });
          });
        },
        async () => {
          stopBeep();
          setIsRecording(false);
          setShowSummary(true);
        }
      );
      recorderRef.current = recorder;
    } catch {
      toast.error("Microphone access required");
      setIsRecording(false);
      setNazraMode(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    stopBeep();
    setIsRecording(false);
    setShowSummary(true);
  }, []);

  const getWordColor = (globalIdx: number) => {
    if (!hifzMode && !nazraMode) return undefined;
    return wordStatuses[globalIdx];
  };

  const correctCount = Object.values(wordStatuses).filter(s => s === "correct").length;
  const closeCount = Object.values(wordStatuses).filter(s => s === "close").length;
  const wrongCount = Object.values(wordStatuses).filter(s => s === "wrong").length;
  const totalWords = flatWords.current.length;
  const accuracy = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

  // Long press handlers for play button
  const handlePlayMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setShowPlayMenu(true);
    }, 500);
  };
  const handlePlayMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPlayMenu) return;
    if (isPlaying) stopAudio();
    else playAudio();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0F0D" }}>
      {/* TOP BAR */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={onBack} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.08)" }}>
          <Menu size={18} className="text-foreground" />
        </button>
        <div className="text-center">
          <p className="font-arabic font-bold" style={{ fontSize: 16, color: "#C9A84C" }}>
            {pageData?.meta.surahName || "Loading..."}
          </p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            Page {currentPage} | Juz {pageData?.meta.juz || 1} | {qariName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.08)" }}>
            <Settings size={16} className="text-foreground" />
          </button>
        </div>
      </div>

      {/* NoorDetect banner */}
      {highlightedAyahKey && (
        <div className="mx-4 mt-2 px-4 py-3 rounded-xl flex items-center justify-between" style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.4)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>✨</span>
            <div>
              <p style={{ fontSize: 12, color: "#C9A84C", fontWeight: 700 }}>NoorDetect found this verse!</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{highlightedAyahKey}</p>
            </div>
          </div>
          <button onClick={() => setHighlightedAyahKey(null)} className="p-1"><X size={14} style={{ color: "rgba(255,255,255,0.4)" }} /></button>
        </div>
      )}

      {/* Mode banners */}
      {hifzMode && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl flex items-center justify-between" style={{ background: "rgba(109,40,217,0.12)", border: "1px solid rgba(109,40,217,0.3)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🧠</span>
            <span style={{ fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>Hifz Mode — AI listens for Arabic only</span>
          </div>
        </div>
      )}
      {nazraMode && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl flex items-center justify-between" style={{ background: "rgba(37,165,102,0.12)", border: "1px solid rgba(37,165,102,0.3)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>👁️</span>
            <span style={{ fontSize: 12, color: "#25A566", fontWeight: 700 }}>Nazra Mode — Read aloud</span>
          </div>
        </div>
      )}

      {/* MUSHAF PAGE */}
      <div
        className="flex-1 overflow-y-auto scrollbar-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTapZone}
        style={{ padding: "16px 12px", paddingBottom: 140 }}
      >
        <div
          className={`rounded-xl transition-all duration-500 ${showFlip ? (flipDirection === "left" ? "animate-page-flip-left" : "animate-page-flip-right") : ""}`}
          style={{
            background: "#111A14",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 12,
            padding: "20px 16px",
            minHeight: 500,
            position: "relative",
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23111A14'/%3E%3Crect width='1' height='1' fill='%23131D16' opacity='0.3'/%3E%3C/svg%3E\")",
          }}
        >
          {loading ? (
            <div className="flex flex-col gap-4 py-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : pageData ? (
            <>
              {pageData.verses.map((verse, vi) => {
                const surahNum = parseInt(verse.verse_key.split(":")[0]);
                const prevSurahNum = vi > 0 ? parseInt(pageData.verses[vi - 1].verse_key.split(":")[0]) : -1;
                const isNewSurah = verse.verse_number === 1 || surahNum !== prevSurahNum;
                const isHighlighted = highlightedAyahKey === verse.verse_key;

                let globalWordStart = 0;
                for (let i = 0; i < vi; i++) {
                  globalWordStart += pageData.verses[i].words.filter(w => w.char_type_name === "word").length;
                }

                return (
                  <div key={verse.verse_key}>
                    {isNewSurah && (
                      <>
                        <div className="text-center my-4 py-3 px-4 rounded-lg" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
                          <p className="font-arabic" style={{ fontSize: 22, color: "#C9A84C" }}>
                            سُورَةُ {pageData.meta.surahArabic}
                          </p>
                        </div>
                        {surahNum !== 9 && (
                          <p className="font-arabic text-center my-3" style={{ fontSize: 20, color: "#C9A84C" }}>
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                          </p>
                        )}
                      </>
                    )}

                    <div
                      className="mb-3 px-2 py-2 rounded-lg transition-all duration-300"
                      data-ayah={verse.verse_number}
                      style={{
                        ...(isHighlighted ? {
                          background: "rgba(201,168,76,0.15)",
                          border: "1px solid rgba(201,168,76,0.4)",
                          animation: "identifiedGlow 2s ease",
                        } : {}),
                      }}
                    >
                      {/* Words (RTL flow) */}
                      <div className="flex flex-wrap justify-end gap-1" dir="rtl" style={{ lineHeight: 2.2 }}>
                        {verse.words.map((word, wi) => {
                          const isEnd = word.char_type_name === "end";
                          const globalIdx = globalWordStart + verse.words.slice(0, wi).filter(w => w.char_type_name === "word").length;
                          const status = getWordColor(globalIdx);
                          const isWaiting = (hifzMode || nazraMode) && isRecording && globalIdx === wordPointer;
                          const tajweedColor = showTajweed ? TAJWEED_COLORS[word.char_type_name] : undefined;

                          if (isEnd) {
                            return (
                              <span key={word.id} className="inline-flex items-center justify-center mx-1" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(201,168,76,0.4)", fontSize: 11, color: "#C9A84C", fontWeight: 600 }}>
                                {verse.verse_number}
                              </span>
                            );
                          }

                          return (
                            <span
                              key={word.id}
                              data-index={globalIdx}
                              data-ayah={verse.verse_number}
                              className={`inline-block font-arabic transition-all duration-200 rounded-md px-1 py-0.5 cursor-pointer ${isWaiting ? "animate-pulse" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!hifzMode && !nazraMode && word.translation) {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setSelectedWord({ word, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                                  setTimeout(() => setSelectedWord(null), 3000);
                                }
                              }}
                              style={{
                                fontSize: arabicFontSize,
                                color: status === "correct" ? "#4ADE80"
                                     : status === "close" ? "#FCD34D"
                                     : status === "wrong" ? "#F87171"
                                     : tajweedColor || "#F0D080",
                                background: status === "correct" ? "rgba(74,222,128,0.12)"
                                          : status === "close" ? "rgba(252,211,77,0.1)"
                                          : status === "wrong" ? "rgba(248,113,113,0.1)"
                                          : "transparent",
                                filter: hifzMode && !status && !isWaiting ? "blur(5px)" : "blur(0)",
                                textDecoration: status === "wrong" ? "underline wavy #F87171" : "none",
                                textShadow: status === "correct" ? "0 0 10px rgba(74,222,128,0.4)" : "none",
                                ...(isWaiting ? { border: "1px solid rgba(201,168,76,0.4)", boxShadow: "0 0 8px rgba(201,168,76,0.3)" } : {}),
                                ...(isHighlighted && !hifzMode && !nazraMode ? { color: "#FFD700", background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)", transform: "scale(1.05)" } : {}),
                              }}
                            >
                              {word.text_uthmani}
                            </span>
                          );
                        })}
                      </div>

                      {/* Peek button per ayah in hifz mode */}
                      {hifzMode && (
                        <div className="flex justify-end mt-1">
                          <button
                            onMouseDown={() => setPeekingAyah(verse.verse_key)}
                            onMouseUp={() => setPeekingAyah(null)}
                            onMouseLeave={() => setPeekingAyah(null)}
                            onTouchStart={() => setPeekingAyah(verse.verse_key)}
                            onTouchEnd={() => setPeekingAyah(null)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full"
                            style={{ fontSize: 10, color: peekingAyah === verse.verse_key ? "#C9A84C" : "rgba(255,255,255,0.3)", background: peekingAyah === verse.verse_key ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)" }}
                          >
                            <Eye size={10} /> Peek
                          </button>
                        </div>
                      )}

                      {/* Translation below each ayah */}
                      {showTranslation && !hifzMode && verse.translation && (
                        <div>
                          <div className="h-px mt-2 mb-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                          <p dir="ltr" className="italic" style={{ fontSize: transFontSize, color: "#9CA3AF", lineHeight: 1.5 }}>
                            {verse.translation}
                          </p>
                        </div>
                      )}

                      {/* Verse actions (non-hifz/nazra) */}
                      {!hifzMode && !nazraMode && (
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleBookmark(verse); }} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: bookmarkedRefs.has(verse.verse_key.replace(":", " ")) ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)" }}>
                            {bookmarkedRefs.has(verse.verse_key.replace(":", " ")) ? <BookmarkCheck size={12} style={{ color: "#C9A84C" }} /> : <Bookmark size={12} style={{ color: "rgba(255,255,255,0.3)" }} />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); const [sn, an] = verse.verse_key.split(":").map(Number); playAyahAudio(sn, an); }} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.05)" }}>
                            <Volume2 size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setShareAyah({ arabic: verse.text_uthmani, translation: verse.translation || "", reference: verse.verse_key }); }} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.05)" }}>
                            <Share2 size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Tajweed Legend */}
              {showTajweed && (
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {TAJWEED_LEGEND.map((t) => (
                    <div key={t.label} className="flex items-center gap-1">
                      <div className="rounded-full" style={{ width: 8, height: 8, background: t.color }} />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center mt-4" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                — {currentPage} —
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Word Translation Popup */}
      {selectedWord && (
        <div
          className="fixed z-[80] animate-fade-slide-in"
          style={{ left: Math.min(Math.max(selectedWord.x - 100, 16), 193), top: selectedWord.y, width: 200 }}
          onClick={() => setSelectedWord(null)}
        >
          <div className="p-3 rounded-xl" style={{ background: "#111A14", border: "1px solid rgba(201,168,76,0.4)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            <p className="font-arabic text-center" dir="rtl" style={{ fontSize: 20, color: "#F0D080" }}>{selectedWord.word.text_uthmani}</p>
            <div className="h-px my-2" style={{ background: "rgba(201,168,76,0.2)" }} />
            {selectedWord.word.transliteration && (
              <p className="text-center italic" style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{selectedWord.word.transliteration}</p>
            )}
            <p className="text-center mt-1" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{selectedWord.word.translation || "—"}</p>
            <button onClick={() => setSelectedWord(null)} className="w-full text-center mt-2" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>✕ Close</button>
          </div>
        </div>
      )}

      {/* Hifz/Nazra live text */}
      {(hifzMode || nazraMode) && isRecording && liveText && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl" style={{ maxWidth: 360, background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Hearing: {liveText}</p>
        </div>
      )}

      {/* Counter */}
      {(hifzMode || nazraMode) && isRecording && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.8)" }}>
          <p style={{ fontSize: 11, color: "#C9A84C" }}>{wordPointer}/{totalWords} | {accuracy}%</p>
        </div>
      )}

      {/* MISTAKE TOAST */}
      {mistakes.length > 0 && isRecording && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl" style={{ maxWidth: 340, background: "rgba(20,0,0,0.95)", border: "1px solid rgba(248,113,113,0.3)" }}>
          <p style={{ fontSize: 12, color: "#F87171", fontWeight: 700 }}>❌ Mistake!</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>You said: <span className="font-arabic" style={{ color: "#F87171" }}>{mistakes[mistakes.length - 1].spoken}</span></p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Correct: <span className="font-arabic" style={{ color: "#4ADE80" }}>{mistakes[mistakes.length - 1].correct}</span></p>
          <div className="flex gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); setWordPointer(prev => Math.max(0, prev - 1)); }} className="px-3 py-1 rounded-lg" style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>🔁 Retry</button>
            <button onClick={(e) => { e.stopPropagation(); }} className="px-3 py-1 rounded-lg" style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>Skip →</button>
          </div>
        </div>
      )}

      {/* NAZRA MISTAKE CARD */}
      {showNazraMistake && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl w-[320px]" style={{ background: "rgba(20,0,0,0.95)", border: "1px solid rgba(252,211,77,0.3)" }}>
          <p style={{ fontSize: 12, color: "#FCD34D", fontWeight: 700 }}>⚠️ Tajweed Mistake!</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Word: <span className="font-arabic" style={{ color: "#F87171" }}>{showNazraMistake.word}</span></p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Type: {showNazraMistake.type}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Should be: <span className="font-arabic" style={{ color: "#4ADE80" }}>{showNazraMistake.correct}</span></p>
          <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.08)" }} />
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>🔊 Qari will recite this ayah for you</p>
          <div className="flex gap-2 mt-2">
            <button onClick={(e) => {
              e.stopPropagation();
              // Play current ayah from qari
              const words = flatWords.current;
              if (wordPointer > 0 && words[wordPointer - 1]) {
                const [sn, an] = words[wordPointer - 1].verseKey.split(":").map(Number);
                playAyahAudio(sn, an);
              }
            }} className="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1" style={{ fontSize: 11, background: "rgba(37,165,102,0.2)", color: "#25A566" }}>
              <Play size={12} /> Listen
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowNazraMistake(null); }} className="flex-1 py-1.5 rounded-lg" style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* SESSION SUMMARY */}
      {showSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }}>
          <div className="w-full max-w-sm mx-4 p-6 rounded-2xl" style={{ background: "#111A14", border: "1px solid rgba(201,168,76,0.3)" }}>
            <p className="text-center text-lg font-bold" style={{ color: "#C9A84C" }}>{nazraMode ? "👁️" : "🧠"} Session Complete!</p>
            <p className="text-center mt-1" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Page {currentPage} — {pageData?.meta.surahName} {nazraMode ? "(Nazra)" : "(Hifz)"}</p>
            <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#F0D080" }}>{totalWords}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Words</p>
              </div>
              <div className="p-2 rounded-lg" style={{ background: "rgba(74,222,128,0.08)" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#4ADE80" }}>{correctCount}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>✅ Correct</p>
              </div>
              <div className="p-2 rounded-lg" style={{ background: "rgba(252,211,77,0.08)" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FCD34D" }}>{closeCount}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>⚠️ Close</p>
              </div>
              <div className="p-2 rounded-lg" style={{ background: "rgba(248,113,113,0.08)" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#F87171" }}>{wrongCount}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>❌ Wrong</p>
              </div>
            </div>
            <div className="text-center mt-3">
              <p style={{ fontSize: 28, fontWeight: 800, color: accuracy >= 90 ? "#4ADE80" : accuracy >= 70 ? "#FCD34D" : "#F87171" }}>{accuracy}% {accuracy >= 90 ? "🌟" : ""}</p>
            </div>
            {mistakes.length > 0 && (
              <div className="mt-3">
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Mistakes:</p>
                {mistakes.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-1" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span className="font-arabic" style={{ fontSize: 14, color: "#F87171" }}>{m.spoken}</span>
                    <span className="font-arabic" style={{ fontSize: 14, color: "#4ADE80" }}>{m.correct}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowSummary(false); setWordPointer(0); setWordStatuses({}); setMistakes([]); setNazraMode(false); }} className="flex-1 py-2.5 rounded-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                🔁 Retry
              </button>
              <button onClick={() => { setShowSummary(false); setNazraMode(false); flipPage("next"); }} className="flex-1 py-2.5 rounded-xl font-semibold active:scale-95 transition-transform" style={{ background: "#25A566", color: "#fff", fontSize: 13 }}>
                Next Page →
              </button>
            </div>
            <button onClick={() => { setShowSummary(false); setHifzMode(false); setNazraMode(false); }} className="w-full mt-2 py-2 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Play mode menu popup */}
      {showPlayMenu && (
        <div className="fixed bottom-[180px] left-1/2 -translate-x-1/2 z-[60] animate-slide-up" onClick={(e) => e.stopPropagation()}>
          <div className="p-3 rounded-xl" style={{ background: "#111A14", border: "1px solid rgba(201,168,76,0.3)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", width: 180 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Choose Mode:</p>
            <button onClick={() => { setShowPlayMenu(false); playAudio(); }} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg mb-1 active:scale-95 transition-transform" style={{ background: "rgba(37,165,102,0.1)", color: "#25A566", fontSize: 13 }}>
              <Play size={14} /> Play Audio
            </button>
            <button onClick={() => { setShowPlayMenu(false); startNazraRecording(); }} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg active:scale-95 transition-transform" style={{ background: "rgba(109,40,217,0.1)", color: "#A78BFA", fontSize: 13 }}>
              <Mic size={14} /> Nazra Mode
            </button>
          </div>
          <button onClick={() => setShowPlayMenu(false)} className="w-full mt-2 text-center" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Cancel</button>
        </div>
      )}

      {/* BOTTOM TOOLBAR */}
      <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full z-40" style={{ maxWidth: 393 }}>
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(10,15,13,0.95)", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
          {/* RTL: Right arrow = next page (forward), Left arrow = prev page */}
          <button onClick={() => flipPage("next")} disabled={currentPage >= TOTAL_PAGES} className="p-2 rounded-full active:scale-90 transition-transform disabled:opacity-30" style={{ color: "#C9A84C" }}>
            <ChevronRight size={20} />
          </button>
          <div className="flex-1 mx-2">
            <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(currentPage / TOTAL_PAGES) * 100}%`, background: "linear-gradient(90deg, #C9A84C, #25A566)" }} />
            </div>
            <p className="text-center mt-1" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Page {currentPage} / {TOTAL_PAGES}</p>
          </div>
          <button onClick={() => flipPage("prev")} disabled={currentPage <= 1} className="p-2 rounded-full active:scale-90 transition-transform disabled:opacity-30" style={{ color: "#C9A84C" }}>
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Action toolbar */}
        <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(10,15,13,0.98)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); }} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 16 }}>🤲</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setHifzMode(!hifzMode); setNazraMode(false); if (hifzMode) { setWordStatuses({}); setWordPointer(0); setMistakes([]); } }} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: hifzMode ? "rgba(109,40,217,0.25)" : "rgba(255,255,255,0.06)" }}>
              {hifzMode ? <EyeOff size={18} style={{ color: "#A78BFA" }} /> : <Eye size={18} style={{ color: "rgba(255,255,255,0.4)" }} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Settings size={18} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Play button — long press for Nazra mode */}
            <button
              onClick={handlePlayClick}
              onMouseDown={handlePlayMouseDown}
              onMouseUp={handlePlayMouseUp}
              onTouchStart={handlePlayMouseDown}
              onTouchEnd={handlePlayMouseUp}
              className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
              style={{
                width: 44, height: 44,
                background: isPlaying ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
              }}
            >
              {isPlaying ? <Pause size={20} style={{ color: "#ef4444" }} /> : <Play size={20} style={{ color: "#C9A84C" }} />}
            </button>

            {/* Mic button — always visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                  stopRecording();
                } else if (hifzMode) {
                  startHifzRecording();
                } else if (nazraMode) {
                  startNazraRecording();
                } else {
                  // If no mode active, activate hifz mode and start
                  setHifzMode(true);
                  setTimeout(() => startHifzRecording(), 100);
                }
              }}
              className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
              style={{
                width: 56, height: 56,
                background: isRecording ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #25A566, #1A7A4A)",
                boxShadow: isRecording ? "0 0 30px rgba(239,68,68,0.5)" : hifzMode ? "0 0 20px rgba(201,168,76,0.4)" : "0 0 20px rgba(37,165,102,0.3)",
                ...(hifzMode && !isRecording ? { animation: "pulse-gold 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}),
              }}
            >
              {isRecording ? <Square size={22} style={{ color: "#fff" }} /> : <Mic size={24} style={{ color: "#fff" }} />}
            </button>
          </div>
        </div>
      </div>

      {/* SETTINGS OVERLAY */}
      {showSettings && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm mx-4 p-5 rounded-2xl max-h-[80vh] overflow-y-auto scrollbar-none" style={{ background: "#111A14", border: "1px solid rgba(201,168,76,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontSize: 16, fontWeight: 700, color: "#C9A84C" }}>Reading Settings</p>
              <button onClick={() => setShowSettings(false)}><X size={18} style={{ color: "rgba(255,255,255,0.4)" }} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Arabic Font Size: {arabicFontSize}px</p>
                <Slider value={[arabicFontSize]} min={16} max={36} step={1} onValueChange={([v]) => setArabicFontSize(v)} />
                <p className="font-arabic text-right mt-2" dir="rtl" style={{ fontSize: arabicFontSize, color: "#F0D080" }}>بِسْمِ ٱللَّهِ</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Translation Size: {transFontSize}px</p>
                <Slider value={[transFontSize]} min={10} max={18} step={1} onValueChange={([v]) => setTransFontSize(v)} />
              </div>

              {/* Qari selection */}
              <div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Reciter (Qari)</p>
                <select
                  value={selectedQari}
                  onChange={e => { setSelectedQari(e.target.value); localStorage.setItem("quran_qari", e.target.value); }}
                  className="w-full bg-transparent outline-none px-3 py-2 rounded-lg"
                  style={{ fontSize: 13, color: "#C9A84C", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {QARIS.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Show Translation</span>
                <button onClick={() => setShowTranslation(!showTranslation)} className="w-10 h-6 rounded-full transition-all" style={{ background: showTranslation ? "#25A566" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-4 h-4 rounded-full bg-white transition-all" style={{ marginLeft: showTranslation ? 20 : 4, marginTop: 4 }} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Tajweed Colors</span>
                <button onClick={() => setShowTajweed(!showTajweed)} className="w-10 h-6 rounded-full transition-all" style={{ background: showTajweed ? "#25A566" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-4 h-4 rounded-full bg-white transition-all" style={{ marginLeft: showTajweed ? 20 : 4, marginTop: 4 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShareCardSheet open={!!shareAyah} onClose={() => setShareAyah(null)} arabic={shareAyah?.arabic || ""} translation={shareAyah?.translation || ""} reference={shareAyah?.reference || ""} type="Quran" />
    </div>
  );
};

// Helper: calculate absolute ayah number from surah:ayah
const SURAH_AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

function getAbsoluteAyahNumber(surahNum: number, ayahNum: number): number {
  let total = 0;
  for (let i = 0; i < surahNum - 1; i++) {
    total += SURAH_AYAH_COUNTS[i] || 0;
  }
  return total + ayahNum;
}

export default QuranScreen;
