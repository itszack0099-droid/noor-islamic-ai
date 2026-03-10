import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Mic, Square, Play, Pause, Bookmark, BookmarkCheck, Share2, RotateCcw, Eye, CheckCircle, BarChart3, ScrollText, Brain, Star, AlertTriangle, Search, Volume2, VolumeX } from "lucide-react";
import VerseIdentifier from "@/components/VerseIdentifier";
import CrossReferenceSheet from "@/components/CrossReferenceSheet";
import QuranAudioPlayer from "@/components/QuranAudioPlayer";
import ShareCardSheet from "@/components/ShareCardSheet";
import TarteelMode from "@/components/TarteelMode";
import HifzAI from "@/components/HifzAI";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { addBookmark, removeBookmarkByRef } from "@/components/BookmarksScreen";
import { toast } from "sonner";
import { startBeep, stopBeep } from "@/lib/audioFeedback";

interface Surah { number: number; name: string; englishName: string; englishNameTranslation: string; numberOfAyahs: number; revelationType: string; }
interface Ayah { number: number; numberInSurah: number; text: string; translation: string; secondaryTranslation?: string; }
interface WordResult { word: string; status: "correct" | "wrong" | "skipped"; spoken?: string; }
interface RecitationResult { ayahIdx: number; words: WordResult[]; score: number; total: number; }
interface HifzRecord { surah_number: number; ayah_number: number; memorized: boolean; peek_count: number; last_practiced_at: string; }
interface QuranScreenProps { onBack: () => void; }

const CACHE_PREFIX = "quran_surah_";
type HifzLevel = "easy" | "medium" | "hard";

function stripDiacritics(s: string) {
  return s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "").trim();
}
function normalizeArabic(s: string) {
  return stripDiacritics(s).replace(/\u0671/g, "\u0627").replace(/[\u0622\u0623\u0625]/g, "\u0627").replace(/\u0629/g, "\u0647").replace(/\s+/g, " ").trim();
}
function compareWords(expected: string, spoken: string): WordResult[] {
  const expWords = expected.split(/\s+/).filter(Boolean);
  const spkWords = spoken.split(/\s+/).filter(Boolean);
  const results: WordResult[] = [];
  let si = 0;
  for (let ei = 0; ei < expWords.length; ei++) {
    const ew = normalizeArabic(expWords[ei]);
    if (si < spkWords.length && normalizeArabic(spkWords[si]) === ew) { results.push({ word: expWords[ei], status: "correct" }); si++; }
    else if (si < spkWords.length) { results.push({ word: expWords[ei], status: "wrong", spoken: spkWords[si] }); si++; }
    else { results.push({ word: expWords[ei], status: "skipped" }); }
  }
  return results;
}

function generateBlankLine(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map(() => "─────").join("  ");
}

const QuranScreen = ({ onBack }: QuranScreenProps) => {
  const { t, isRtl, quranEdition, secondaryQuranEdition } = useI18n();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeAyahIdx, setActiveAyahIdx] = useState(0);
  const [result, setResult] = useState<RecitationResult | null>(null);
  const recognitionRef = useRef<any>(null);

  // Hifz state
  const [hifzMode, setHifzMode] = useState(false);
  const [hifzLevel, setHifzLevel] = useState<HifzLevel>("medium");
  const [peekingAyah, setPeekingAyah] = useState<number | null>(null);
  const [peekCounts, setPeekCounts] = useState<Record<number, number>>({});
  const [hifzRecords, setHifzRecords] = useState<Record<number, HifzRecord>>({});
  const [showProgress, setShowProgress] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Other UI state
  const [crossRefAyah, setCrossRefAyah] = useState<{ text: string; reference: string } | null>(null);
  const [audioAyahIdx, setAudioAyahIdx] = useState<number | null>(null);
  const [shareAyah, setShareAyah] = useState<{ arabic: string; translation: string; reference: string } | null>(null);
  const [bookmarkedRefs, setBookmarkedRefs] = useState<Set<string>>(new Set());
  const [showIdentifier, setShowIdentifier] = useState(false);
  const [tarteelAyahIdx, setTarteelAyahIdx] = useState<number | null>(null);
  const [showHifzAI, setShowHifzAI] = useState(false);

  const handleOpenInQuran = (surahNum: number, _ayahNum: number) => {
    const surah = surahs.find(s => s.number === surahNum);
    if (surah) {
      setSelectedSurah(surah);
      setShowIdentifier(false);
    }
  };

  // Fetch surahs
  useEffect(() => {
    const cached = localStorage.getItem("quran_surah_list");
    if (cached) { setSurahs(JSON.parse(cached)); setLoadingSurahs(false); return; }
    fetch("https://api.alquran.cloud/v1/surah").then(r => r.json()).then(d => {
      setSurahs(d.data); localStorage.setItem("quran_surah_list", JSON.stringify(d.data));
    }).finally(() => setLoadingSurahs(false));
  }, []);

  // Fetch ayahs
  useEffect(() => {
    if (!selectedSurah) return;
    setLoadingAyahs(true);
    const editions = ["quran-uthmani", quranEdition];
    if (secondaryQuranEdition) editions.push(secondaryQuranEdition);
    const cacheKey = `${CACHE_PREFIX}${selectedSurah.number}_${editions.join("_")}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setAyahs(JSON.parse(cached)); setLoadingAyahs(false); return; }
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah.number}/editions/${editions.join(",")}`)
      .then(r => r.json()).then(d => {
        const arabic = d.data[0].ayahs;
        const primary = d.data[1].ayahs;
        const secondary = d.data[2]?.ayahs;
        const merged: Ayah[] = arabic.map((a: any, i: number) => ({
          number: a.number, numberInSurah: a.numberInSurah, text: a.text,
          translation: primary[i]?.text || "",
          secondaryTranslation: secondary?.[i]?.text || undefined,
        }));
        setAyahs(merged); localStorage.setItem(cacheKey, JSON.stringify(merged));
      }).finally(() => setLoadingAyahs(false));
  }, [selectedSurah, quranEdition, secondaryQuranEdition]);

  // Load bookmarks
  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("bookmarks") as any).select("reference").eq("user_id", user.id).eq("type", "quran");
      if (data) setBookmarkedRefs(new Set(data.map((b: any) => b.reference)));
    })();
  }, [selectedSurah]);

  // Fetch hifz records
  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("hifz_progress").select("*").eq("user_id", user.id).eq("surah_number", selectedSurah.number) as any;
      if (data) {
        const map: Record<number, HifzRecord> = {};
        const peeks: Record<number, number> = {};
        for (const r of data) { map[r.ayah_number] = r; peeks[r.ayah_number] = r.peek_count; }
        setHifzRecords(map); setPeekCounts(peeks);
      }
    })();
  }, [selectedSurah]);

  const toggleBookmark = async (ayah: Ayah) => {
    if (!selectedSurah) return;
    const ref = `${selectedSurah.englishName} ${selectedSurah.number}:${ayah.numberInSurah}`;
    if (bookmarkedRefs.has(ref)) {
      await removeBookmarkByRef(ref);
      setBookmarkedRefs(prev => { const n = new Set(prev); n.delete(ref); return n; });
      toast.success(t("removeBookmark"));
    } else {
      await addBookmark("quran", ayah.text, ayah.translation, ref);
      setBookmarkedRefs(prev => new Set(prev).add(ref));
      toast.success(t("bookmark") + " ✓");
    }
  };

  const markMemorized = async (ayahNum: number, accuracy?: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedSurah) return;
    const payload = {
      user_id: user.id, surah_number: selectedSurah.number, ayah_number: ayahNum,
      memorized: true, peek_count: peekCounts[ayahNum] || 0,
      last_practiced_at: new Date().toISOString(),
    };
    await (supabase.from("hifz_progress") as any).upsert(payload, { onConflict: "user_id,surah_number,ayah_number" });
    setHifzRecords(prev => ({ ...prev, [ayahNum]: { ...payload } as any }));
    toast.success("⭐ Marked as memorized!");
  };

  const handlePeekStart = (ayahNum: number) => {
    setPeekingAyah(ayahNum);
    setPeekCounts(prev => ({ ...prev, [ayahNum]: (prev[ayahNum] || 0) + 1 }));
    peekTimerRef.current = setTimeout(() => setPeekingAyah(null), 2000);
  };
  const handlePeekEnd = () => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeekingAyah(null);
  };

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || ayahs.length === 0) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    setResult(null); setListening(true);
    startBeep();
    const recognition = new SR();
    recognition.lang = "ar-SA"; recognition.interimResults = false; recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onresult = (e: any) => {
      const spoken = e.results[0][0].transcript || "";
      const ayah = ayahs[activeAyahIdx];
      const words = compareWords(ayah.text, spoken);
      const correct = words.filter(w => w.status === "correct").length;
      setResult({ ayahIdx: activeAyahIdx, words, score: correct, total: words.length });
      setListening(false);
      stopBeep();
      if (correct === words.length && activeAyahIdx < ayahs.length - 1) {
        setTimeout(() => { setActiveAyahIdx(prev => prev + 1); setResult(null); }, 2000);
      }
    };
    recognition.onerror = () => { setListening(false); stopBeep(); };
    recognition.onend = () => setListening(false);
    recognition.start();
  }, [ayahs, activeAyahIdx]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); stopBeep(); }, []);

  const memorizedCount = Object.values(hifzRecords).filter(r => r.memorized).length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const needsReviewCount = Object.values(hifzRecords).filter(r => r.memorized && new Date(r.last_practiced_at).getTime() < sevenDaysAgo).length;

  // =================== HIFZ AI MODE ===================
  if (showHifzAI) {
    return <HifzAI surahs={surahs} onBack={() => setShowHifzAI(false)} />;
  }

  // =================== SURAH LIST ===================
  if (!selectedSurah) {
    return (
      <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
        <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("quran")}</h2>
            <button onClick={() => setShowIdentifier(true)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <Search size={18} className="text-foreground" />
            </button>
          </div>
          </div>
          {/* HifzAI button */}
          <button
            onClick={() => setShowHifzAI(true)}
            className="mx-5 mb-2 flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, rgba(109,40,217,0.15), rgba(201,168,76,0.1))", border: "1px solid rgba(109,40,217,0.25)" }}
          >
            <Brain size={20} style={{ color: "#A78BFA" }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#A78BFA" }}>🧠 HifzAI</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>AI-powered memorization checker</p>
            </div>
          </button>
        <div className="px-4 py-3">
          {loadingSurahs
            ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <Skeleton className="w-10 h-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
                </div>
              ))
            : surahs.map((s) => (
                <button key={s.number} onClick={() => { setSelectedSurah(s); setActiveAyahIdx(0); setResult(null); setHifzMode(false); setShowProgress(false); }} className="flex items-center gap-3 w-full text-left py-3 active:scale-[0.98] transition-transform" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-center font-bold shrink-0" style={{ width: 40, height: 40, borderRadius: 10, background: "#0D4D2E", color: "#25A566", fontSize: 13 }}>{s.number}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-foreground font-semibold" style={{ fontSize: 14 }}>{s.englishName}</p>
                      <p className="font-arabic" style={{ fontSize: 18, color: "#C9A84C" }}>{s.name}</p>
                    </div>
                    <p className="text-muted-foreground" style={{ fontSize: 11 }}>{s.englishNameTranslation} · {s.numberOfAyahs} Ayaat · {s.revelationType === "Meccan" ? "Makki" : "Madani"}</p>
                  </div>
                </button>
              ))}
        </div>
        <VerseIdentifier open={showIdentifier} onClose={() => setShowIdentifier(false)} mode="quran" onOpenInQuran={handleOpenInQuran} />
      </div>
    );
  }

  // =================== HIFZ PROGRESS ===================
  if (showProgress) {
    return (
      <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
        <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={() => setShowProgress(false)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("hifzProgress")}</h2>
            <div style={{ width: 36 }} />
          </div>
        </div>

        <div className="px-5 py-4">
          {/* Stats cards */}
          <div className="flex gap-3">
            {[
              { label: t("memorized"), count: memorizedCount, color: "#25A566", icon: "⭐" },
              { label: t("needsReview"), count: needsReviewCount, color: "#f59e0b", icon: "⚠️" },
              { label: t("notStarted"), count: ayahs.length - Object.keys(hifzRecords).length, color: "rgba(255,255,255,0.2)", icon: "📖" },
            ].map((s) => (
              <div key={s.label} className="flex-1 p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontSize: 14 }}>{s.icon}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4 rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${ayahs.length > 0 ? (memorizedCount / ayahs.length) * 100 : 0}%`, background: "linear-gradient(90deg, #25A566, #1A7A4A)" }} />
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {memorizedCount}/{ayahs.length} ayaat memorized
          </p>

          {/* Daily revision target */}
          {needsReviewCount > 0 && (
            <div className="mt-4 p-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
              <div>
                <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>Revise {Math.min(5, needsReviewCount)} ayaat today</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{needsReviewCount} ayaat need review</p>
              </div>
            </div>
          )}
        </div>

        {/* Ayah grid */}
        <div className="px-5 pb-4">
          <p className="mb-2 uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>Ayah Map</p>
          <div className="flex flex-wrap gap-1.5">
            {ayahs.map((ayah) => {
              const rec = hifzRecords[ayah.numberInSurah];
              const isMemorized = rec?.memorized;
              const needsReview = isMemorized && new Date(rec.last_practiced_at).getTime() < sevenDaysAgo;
              const bg = isMemorized ? (needsReview ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #25A566, #1A7A4A)") : "rgba(255,255,255,0.06)";
              const color = isMemorized ? "#fff" : "rgba(255,255,255,0.3)";
              return (
                <div key={ayah.numberInSurah} className="flex items-center justify-center font-bold" style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, fontSize: 10 }}>
                  {isMemorized ? (needsReview ? "!" : "⭐") : ayah.numberInSurah}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3">
            {[
              { color: "#25A566", label: "Memorized" },
              { color: "#f59e0b", label: "Needs Review" },
              { color: "rgba(255,255,255,0.15)", label: "Not Started" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="rounded" style={{ width: 10, height: 10, background: l.color }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =================== SURAH DETAIL ===================
  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => { setSelectedSurah(null); setAyahs([]); setResult(null); setListening(false); setHifzMode(false); }} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{selectedSurah.englishName}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowIdentifier(true)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <Search size={16} className="text-foreground" />
            </button>
            <button onClick={() => setShowProgress(true)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <BarChart3 size={16} className="text-foreground" />
            </button>
            <button
              onClick={() => { setHifzMode(!hifzMode); if (!hifzMode) setResult(null); }}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: 36, height: 36,
                background: hifzMode ? "linear-gradient(135deg, #6D28D9, #C9A84C)" : "rgba(255,255,255,0.08)",
                boxShadow: hifzMode ? "0 0 16px rgba(109,40,217,0.4)" : "none",
              }}
            >
              <Brain size={16} style={{ color: hifzMode ? "#fff" : "#F0F4F0" }} />
            </button>
          </div>
        </div>

        {/* Hifz Mode Active Banner */}
        {hifzMode && (
          <div className="mx-5 mb-2">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(135deg, rgba(109,40,217,0.15), rgba(201,168,76,0.1))", borderRadius: "12px 12px 0 0", border: "1px solid rgba(109,40,217,0.25)", borderBottom: "none" }}>
              <div className="flex items-center gap-2">
                <Brain size={14} style={{ color: "#A78BFA" }} />
                <span style={{ fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>🧠 Hifz Mode Active</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>· {memorizedCount}/{ayahs.length}</span>
              </div>
            </div>

            {/* Segmented control for levels */}
            <div className="flex p-1" style={{ background: "rgba(109,40,217,0.08)", borderRadius: "0 0 12px 12px", border: "1px solid rgba(109,40,217,0.25)", borderTop: "none" }}>
              {([
                { key: "easy" as HifzLevel, label: "Easy", desc: "Blurred" },
                { key: "medium" as HifzLevel, label: "Medium", desc: "Blanks" },
                { key: "hard" as HifzLevel, label: "Hard", desc: "Hidden" },
              ]).map((l) => (
                <button
                  key={l.key}
                  onClick={() => setHifzLevel(l.key)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: hifzLevel === l.key ? "linear-gradient(135deg, #6D28D9, #4C1D95)" : "transparent",
                    boxShadow: hifzLevel === l.key ? "0 2px 8px rgba(109,40,217,0.3)" : "none",
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 700, color: hifzLevel === l.key ? "#fff" : "rgba(255,255,255,0.4)" }}>{l.label}</p>
                  <p style={{ fontSize: 9, color: hifzLevel === l.key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>{l.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Surah info bar */}
        <div className="mx-5 flex items-center justify-between px-4 py-3" style={{ background: "rgba(0,0,0,0.3)", borderRadius: "16px 16px 0 0" }}>
          <p className="font-arabic" style={{ fontSize: 22, color: "#C9A84C" }}>{selectedSurah.name}</p>
          <div className="text-right">
            <p className="text-foreground" style={{ fontSize: 13 }}>{selectedSurah.englishNameTranslation}</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>{selectedSurah.numberOfAyahs} Ayaat · {selectedSurah.revelationType === "Meccan" ? "Makki" : "Madani"}</p>
          </div>
        </div>
      </div>

      {/* Listening indicator */}
      {listening && (
        <div className="mx-5 mt-3 flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg, #4C1D95, #6D28D9)", borderRadius: 16, boxShadow: "0 0 20px rgba(109,40,217,0.3)" }}>
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5" style={{ height: 24 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-full" style={{ width: 3, background: "#C9A84C", animation: `wave-bar ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
              Recite Ayah {ayahs[activeAyahIdx]?.numberInSurah || ""} from memory…
            </span>
          </div>
          <button onClick={stopListening} className="px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 600 }}>Stop</button>
        </div>
      )}

      {/* Bismillah */}
      {selectedSurah.number !== 9 && (
        <div className="py-5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-arabic" style={{ fontSize: 22, color: "#F0D080" }}>بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
        </div>
      )}

      {/* Ayah List */}
      <div style={{ paddingBottom: hifzMode ? 100 : 0 }}>
        {loadingAyahs
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton className="h-4 w-8 mb-3" /><Skeleton className="h-6 w-full mb-2" /><Skeleton className="h-4 w-3/4" />
              </div>
            ))
          : ayahs.map((ayah, idx) => {
              const isActive = idx === activeAyahIdx;
              const isListeningThis = isActive && listening;
              const isAudioPlaying = audioAyahIdx === idx;
              const hasResult = result && result.ayahIdx === idx;
              const rec = hifzRecords[ayah.numberInSurah];
              const isMemorized = rec?.memorized;
              const needsReview = isMemorized && new Date(rec.last_practiced_at).getTime() < sevenDaysAgo;
              const isPeeking = peekingAyah === ayah.numberInSurah;
              const peekCount = peekCounts[ayah.numberInSurah] || 0;
              const ref = `${selectedSurah.englishName} ${selectedSurah.number}:${ayah.numberInSurah}`;
              const isSaved = bookmarkedRefs.has(ref);

              // Determine text visibility in hifz mode
              const inHifz = hifzMode && !hasResult;
              const accuracy = hasResult ? Math.round((result!.score / result!.total) * 100) : 0;
              const canMarkMemorized = hasResult && accuracy >= 80 && !isMemorized;

              return (
                <div key={ayah.number} className="px-5 py-4 transition-all" style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  ...(isListeningThis ? { background: "linear-gradient(90deg, rgba(109,40,217,0.06), rgba(201,168,76,0.04))", borderLeft: "3px solid #A78BFA" } : {}),
                  ...(isAudioPlaying && !hifzMode ? { borderLeft: "3px solid #25A566", background: "rgba(37,165,102,0.04)" } : {}),
                  ...(hasResult ? { borderLeft: "3px solid #25A566", background: "rgba(37,165,102,0.04)" } : {}),
                  ...(isMemorized && hifzMode && !hasResult ? { borderLeft: "3px solid #25A566" } : {}),
                  ...(needsReview && hifzMode && !hasResult ? { borderLeft: "3px solid #f59e0b" } : {}),
                }}>
                  {/* Ayah header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center font-bold" style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: isMemorized ? (needsReview ? "#f59e0b" : "#25A566") : isActive ? "rgba(109,40,217,0.3)" : "#0D4D2E",
                        color: "#fff", fontSize: 11,
                      }}>
                        {isMemorized ? "⭐" : ayah.numberInSurah}
                      </div>
                      {isMemorized && <span style={{ fontSize: 10, color: needsReview ? "#f59e0b" : "#25A566", fontWeight: 600 }}>{needsReview ? "Needs Review" : "Memorized"}</span>}
                      {isListeningThis && <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: "rgba(167,139,250,0.2)", color: "#A78BFA", fontWeight: 600 }}>🎤 Listening…</span>}
                      {peekCount > 0 && hifzMode && <span style={{ fontSize: 10, color: "rgba(201,168,76,0.6)" }}>👁 {peekCount}x</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hifzMode && (
                        <button
                          onMouseDown={() => handlePeekStart(ayah.numberInSurah)}
                          onMouseUp={handlePeekEnd}
                          onMouseLeave={handlePeekEnd}
                          onTouchStart={() => handlePeekStart(ayah.numberInSurah)}
                          onTouchEnd={handlePeekEnd}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
                          style={{ background: isPeeking ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.07)", fontSize: 11, color: isPeeking ? "#C9A84C" : "rgba(255,255,255,0.5)", fontWeight: 600 }}
                        >
                          <Eye size={12} /> Peek
                        </button>
                      )}
                      {hifzMode && (
                        <button
                          onClick={() => { setActiveAyahIdx(idx); setResult(null); startListening(); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
                          style={{ background: isActive ? "rgba(109,40,217,0.25)" : "rgba(255,255,255,0.07)", fontSize: 11, color: isActive ? "#A78BFA" : "rgba(255,255,255,0.5)", fontWeight: 600 }}
                        >
                          <Mic size={12} /> Recite
                        </button>
                      )}
                      {!hifzMode && (
                        <>
                          <button onClick={() => setAudioAyahIdx(audioAyahIdx === idx ? null : idx)} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: audioAyahIdx === idx ? "rgba(37,165,102,0.25)" : "rgba(255,255,255,0.07)" }}>
                            {audioAyahIdx === idx ? <Pause size={14} style={{ color: "#25A566" }} /> : <Play size={14} className="text-foreground" />}
                          </button>
                          <button onClick={() => setCrossRefAyah({ text: ayah.text, reference: ref })} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(201,168,76,0.12)" }}>
                            <ScrollText size={14} style={{ color: "#C9A84C" }} />
                          </button>
                          <button onClick={() => toggleBookmark(ayah)} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: isSaved ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.07)" }}>
                            {isSaved ? <BookmarkCheck size={14} style={{ color: "#C9A84C" }} /> : <Bookmark size={14} className="text-foreground" />}
                          </button>
                          <button onClick={() => setShareAyah({ arabic: ayah.text, translation: ayah.translation, reference: ref })} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}>
                            <Share2 size={14} className="text-foreground" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ===== AYAH TEXT ===== */}
                  {hasResult ? (
                    /* Word-by-word result */
                    <p className="font-arabic text-right flex flex-wrap justify-end gap-1.5" dir="rtl" style={{ fontSize: 21, lineHeight: 2 }}>
                      {result!.words.map((w, wi) => (
                        <span key={wi} className="px-1 py-0.5 rounded" style={{
                          color: w.status === "correct" ? "#25A566" : w.status === "wrong" ? "#ef4444" : "#f59e0b",
                          background: w.status === "correct" ? "rgba(37,165,102,0.08)" : w.status === "wrong" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                          textDecoration: w.status === "wrong" ? "underline wavy" : "none",
                        }}>{w.word}</span>
                      ))}
                    </p>
                  ) : inHifz && !isPeeking ? (
                    /* Hidden text based on level */
                    <div dir="rtl">
                      {hifzLevel === "easy" ? (
                        /* Level 1: Blurred */
                        <p className="font-arabic text-right select-none" style={{ fontSize: 21, lineHeight: 1.85, color: "#F0D080", filter: "blur(8px)", WebkitUserSelect: "none", transition: "filter 0.3s" }}>
                          {ayah.text}
                        </p>
                      ) : hifzLevel === "medium" ? (
                        /* Level 2: Blank lines */
                        <p className="text-right font-mono" style={{ fontSize: 16, lineHeight: 2, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>
                          {generateBlankLine(ayah.text)}
                        </p>
                      ) : (
                        /* Level 3: Hidden completely */
                        <div className="flex items-center justify-center py-4" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)" }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>Ayah {ayah.numberInSurah} — Recite from memory</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Normal visible text (or peeking) */
                    <p className="font-arabic text-right" dir="rtl" style={{
                      fontSize: 21, lineHeight: 1.85, color: "#F0D080",
                      ...(isPeeking ? { animation: "pulse-gold 1s ease-in-out" } : {}),
                    }}>{ayah.text}</p>
                  )}

                  {/* Translation (only in normal mode) */}
                  {!hifzMode && !inHifz && (
                    <>
                      <p className="mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{ayah.translation}</p>
                      {ayah.secondaryTranslation && (
                        <p className="mt-1" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, fontStyle: "italic" }}>{ayah.secondaryTranslation}</p>
                      )}
                    </>
                  )}

                  {/* ===== RESULT CARD ===== */}
                  {hasResult && (
                    <div className="mt-3 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {/* Score header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span style={{ fontSize: 15, fontWeight: 700, color: accuracy >= 80 ? "#25A566" : accuracy >= 50 ? "#f59e0b" : "#ef4444" }}>
                            {accuracy === 100 ? "Masha'Allah! Perfect! 🎉" : accuracy >= 80 ? `Great! ${result!.score}/${result!.total} correct ✅` : `${result!.score}/${result!.total} correct`}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="rounded-full overflow-hidden" style={{ width: 80, height: 4, background: "rgba(255,255,255,0.08)" }}>
                              <div className="h-full rounded-full" style={{ width: `${accuracy}%`, background: accuracy >= 80 ? "#25A566" : accuracy >= 50 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{accuracy}%</span>
                          </div>
                        </div>
                        <button onClick={() => { setResult(null); startListening(); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA", fontSize: 11, fontWeight: 600 }}>
                          <RotateCcw size={12} /> Retry
                        </button>
                      </div>

                      {/* Mistakes detail */}
                      {result!.words.filter(w => w.status !== "correct").length > 0 && (
                        <div className="mb-3">
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Mistakes:</p>
                          {result!.words.filter(w => w.status !== "correct").map((w, i) => (
                            <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                              <div className="flex-1">
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{w.status === "skipped" ? "Skipped" : "You said"}:</span>
                                <span className="font-arabic ml-2" style={{ fontSize: 15, color: w.status === "wrong" ? "#ef4444" : "#f59e0b" }}>{w.spoken || "—"}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Correct:</span>
                                <span className="font-arabic ml-2" style={{ fontSize: 15, color: "#25A566" }}>{w.word}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mark as Memorized */}
                      {canMarkMemorized && (
                        <button
                          onClick={() => markMemorized(ayah.numberInSurah, accuracy)}
                          className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
                          style={{ background: "linear-gradient(135deg, rgba(37,165,102,0.15), rgba(37,165,102,0.25))", color: "#25A566", fontSize: 13, fontWeight: 700, border: "1px solid rgba(37,165,102,0.3)" }}
                        >
                          <CheckCircle size={16} /> ✅ Mark as Memorized
                        </button>
                      )}

                      {accuracy === 100 && activeAyahIdx < ayahs.length - 1 && (
                        <p className="text-center mt-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Auto-advancing to next ayah…</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* ===== FLOATING MIC BUTTON (Hifz Mode) ===== */}
      {hifzMode && !listening && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40" style={{ maxWidth: 393 }}>
          <button
            onClick={() => startListening()}
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{
              width: 64, height: 64,
              background: "linear-gradient(135deg, #6D28D9, #C9A84C)",
              boxShadow: "0 4px 24px rgba(109,40,217,0.5), 0 0 48px rgba(201,168,76,0.2)",
            }}
          >
            <Mic size={28} style={{ color: "#fff" }} />
          </button>
        </div>
      )}

      {/* Audio player */}
      {selectedSurah && ayahs.length > 0 && !hifzMode && (
        <QuranAudioPlayer ayahs={ayahs} surahName={selectedSurah.englishName} surahNumber={selectedSurah.number} playingAyahIdx={audioAyahIdx} onPlayAyah={setAudioAyahIdx} />
      )}

      {/* Tarteel floating mic button (non-hifz mode) */}
      {!hifzMode && !listening && ayahs.length > 0 && (
        <div className="fixed bottom-24 right-4 z-40">
          <button
            onClick={() => setTarteelAyahIdx(activeAyahIdx)}
            className="flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
            style={{
              width: 60, height: 60,
              background: "linear-gradient(135deg, #25A566, #1A7A4A)",
              boxShadow: "0 4px 24px rgba(37,165,102,0.5)",
            }}
          >
            <Mic size={24} style={{ color: "#fff" }} />
          </button>
          <p className="text-center mt-1" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Tarteel</p>
        </div>
      )}

      {/* Tarteel Mode overlay */}
      {tarteelAyahIdx !== null && ayahs[tarteelAyahIdx] && (
        <TarteelMode
          ayahText={ayahs[tarteelAyahIdx].text}
          ayahNumber={ayahs[tarteelAyahIdx].numberInSurah}
          surahName={selectedSurah.englishName}
          onComplete={(correct, total) => {
            if (correct === total) {
              toast.success("Masha'Allah! Perfect recitation! 🎉");
              markMemorized(ayahs[tarteelAyahIdx].numberInSurah, 100);
            }
          }}
          onClose={() => setTarteelAyahIdx(null)}
        />
      )}

      <CrossReferenceSheet open={!!crossRefAyah} onClose={() => setCrossRefAyah(null)} type="quran_to_hadith" text={crossRefAyah?.text || ""} reference={crossRefAyah?.reference || ""} />
      <ShareCardSheet open={!!shareAyah} onClose={() => setShareAyah(null)} arabic={shareAyah?.arabic || ""} translation={shareAyah?.translation || ""} reference={shareAyah?.reference || ""} type="Quran" />
      <VerseIdentifier open={showIdentifier} onClose={() => setShowIdentifier(false)} mode="quran" onOpenInQuran={handleOpenInQuran} />
    </div>
  );
};

export default QuranScreen;
