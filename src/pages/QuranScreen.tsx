import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Mic, Square, Play, Bookmark, Share2, RotateCcw, BookOpen, Eye, CheckCircle, BarChart3, ScrollText } from "lucide-react";
import CrossReferenceSheet from "@/components/CrossReferenceSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Surah { number: number; name: string; englishName: string; englishNameTranslation: string; numberOfAyahs: number; revelationType: string; }
interface Ayah { number: number; numberInSurah: number; text: string; translation: string; }
interface WordResult { word: string; status: "correct" | "wrong" | "skipped"; spoken?: string; }
interface RecitationResult { ayahIdx: number; words: WordResult[]; score: number; total: number; }
interface HifzRecord { surah_number: number; ayah_number: number; memorized: boolean; peek_count: number; last_practiced_at: string; }
interface QuranScreenProps { onBack: () => void; }

const CACHE_PREFIX = "quran_surah_";
type Difficulty = "easy" | "medium" | "hard";

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

const QuranScreen = ({ onBack }: QuranScreenProps) => {
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
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [peekingAyah, setPeekingAyah] = useState<number | null>(null);
  const [peekCounts, setPeekCounts] = useState<Record<number, number>>({});
  const [hifzRecords, setHifzRecords] = useState<Record<number, HifzRecord>>({});
  const [showProgress, setShowProgress] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const key = CACHE_PREFIX + selectedSurah.number;
    const cached = localStorage.getItem(key);
    if (cached) { setAyahs(JSON.parse(cached)); setLoadingAyahs(false); return; }
    setLoadingAyahs(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah.number}/editions/quran-uthmani,en.asad`)
      .then(r => r.json()).then(d => {
        const arabic = d.data[0].ayahs; const english = d.data[1].ayahs;
        const merged: Ayah[] = arabic.map((a: any, i: number) => ({ number: a.number, numberInSurah: a.numberInSurah, text: a.text, translation: english[i]?.text || "" }));
        setAyahs(merged); localStorage.setItem(key, JSON.stringify(merged));
      }).finally(() => setLoadingAyahs(false));
  }, [selectedSurah]);

  // Fetch hifz records from DB
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
        setHifzRecords(map);
        setPeekCounts(peeks);
      }
    })();
  }, [selectedSurah]);

  const markMemorized = async (ayahNum: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedSurah) return;
    const payload = { user_id: user.id, surah_number: selectedSurah.number, ayah_number: ayahNum, memorized: true, peek_count: peekCounts[ayahNum] || 0, last_practiced_at: new Date().toISOString() };
    await (supabase.from("hifz_progress") as any).upsert(payload, { onConflict: "user_id,surah_number,ayah_number" });
    setHifzRecords(prev => ({ ...prev, [ayahNum]: { ...payload } as any }));
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
    if (!SR || ayahs.length === 0) return;
    setResult(null); setListening(true);
    const recognition = new SR(); recognition.lang = "ar-SA"; recognition.interimResults = false; recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onresult = (e: any) => {
      const spoken = e.results[0][0].transcript || "";
      const ayah = ayahs[activeAyahIdx];
      const words = compareWords(ayah.text, spoken);
      const correct = words.filter(w => w.status === "correct").length;
      setResult({ ayahIdx: activeAyahIdx, words, score: correct, total: words.length });
      setListening(false);
      if (correct === words.length && activeAyahIdx < ayahs.length - 1) {
        setTimeout(() => { setActiveAyahIdx(prev => prev + 1); setResult(null); }, 1500);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }, [ayahs, activeAyahIdx]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  const toggleMic = () => listening ? stopListening() : startListening();

  const memorizedCount = Object.values(hifzRecords).filter(r => r.memorized).length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // --- SURAH LIST ---
  if (!selectedSurah) {
    return (
      <div className="min-h-screen">
        <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Quran</h2>
            <div style={{ width: 36 }} />
          </div>
        </div>
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
      </div>
    );
  }

  // --- HIFZ PROGRESS VIEW ---
  if (showProgress) {
    return (
      <div className="min-h-screen">
        <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={() => setShowProgress(false)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Hifz Progress</h2>
            <div style={{ width: 36 }} />
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          <div className="flex gap-3">
            {[
              { label: "Memorized", count: memorizedCount, color: "#25A566" },
              { label: "Needs Review", count: Object.values(hifzRecords).filter(r => r.memorized && new Date(r.last_practiced_at).getTime() < sevenDaysAgo).length, color: "#f59e0b" },
              { label: "Not Started", count: ayahs.length - Object.keys(hifzRecords).length, color: "rgba(255,255,255,0.2)" },
            ].map((s) => (
              <div key={s.label} className="flex-1 p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${ayahs.length > 0 ? (memorizedCount / ayahs.length) * 100 : 0}%`, background: "#25A566" }} />
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {memorizedCount}/{ayahs.length} ayaat memorized
          </p>
        </div>

        {/* Ayah grid */}
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {ayahs.map((ayah) => {
              const rec = hifzRecords[ayah.numberInSurah];
              const isMemorized = rec?.memorized;
              const needsReview = isMemorized && new Date(rec.last_practiced_at).getTime() < sevenDaysAgo;
              const bg = isMemorized ? (needsReview ? "#f59e0b" : "#25A566") : "rgba(255,255,255,0.06)";
              const color = isMemorized ? "#fff" : "rgba(255,255,255,0.3)";
              return (
                <div key={ayah.numberInSurah} className="flex items-center justify-center font-bold" style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, fontSize: 10 }}>
                  {ayah.numberInSurah}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- SURAH DETAIL ---
  return (
    <div className="min-h-screen">
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => { setSelectedSurah(null); setAyahs([]); setResult(null); setListening(false); setHifzMode(false); }} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{selectedSurah.englishName}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProgress(true)} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
              <BarChart3 size={16} className="text-foreground" />
            </button>
            <button onClick={() => setHifzMode(!hifzMode)} className="flex items-center justify-center rounded-full transition-all" style={{ width: 36, height: 36, background: hifzMode ? "#25A566" : "rgba(255,255,255,0.08)" }}>
              <BookOpen size={16} style={{ color: hifzMode ? "#fff" : "#F0F4F0" }} />
            </button>
            <button onClick={toggleMic} className="flex items-center justify-center rounded-full transition-all" style={{ width: 36, height: 36, background: listening ? "#ef4444" : "#C9A84C", boxShadow: listening ? "0 0 16px rgba(239,68,68,0.5)" : "none" }}>
              {listening ? <Square size={16} style={{ color: "#fff" }} /> : <Mic size={18} style={{ color: "#0A0F0D" }} />}
            </button>
          </div>
        </div>

        {/* Hifz mode bar */}
        {hifzMode && (
          <div className="mx-5 mb-2 flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(37,165,102,0.12)", borderRadius: 12, border: "1px solid rgba(37,165,102,0.2)" }}>
            <div className="flex items-center gap-2">
              <BookOpen size={14} style={{ color: "#25A566" }} />
              <span style={{ fontSize: 12, color: "#25A566", fontWeight: 600 }}>Hifz Mode</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>· {memorizedCount}/{ayahs.length}</span>
            </div>
            <div className="flex gap-1">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} className="px-2.5 py-1 rounded-full capitalize" style={{ fontSize: 10, fontWeight: 600, background: difficulty === d ? "#25A566" : "rgba(255,255,255,0.07)", color: difficulty === d ? "#fff" : "rgba(255,255,255,0.5)" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-5 flex items-center justify-between px-4 py-3" style={{ background: "rgba(0,0,0,0.3)", borderRadius: "16px 16px 0 0" }}>
          <p className="font-arabic" style={{ fontSize: 22, color: "#C9A84C" }}>{selectedSurah.name}</p>
          <div className="text-right">
            <p className="text-foreground" style={{ fontSize: 13 }}>{selectedSurah.englishNameTranslation}</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>{selectedSurah.numberOfAyahs} Ayaat · {selectedSurah.revelationType === "Meccan" ? "Makki" : "Madani"}</p>
          </div>
        </div>
      </div>

      {/* Listening Bar */}
      {listening && (
        <div className="mx-5 mt-3 flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg, #0D4D2E, #1A7A4A)", borderRadius: 16 }}>
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5" style={{ height: 24 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-full" style={{ width: 3, background: "#25A566", animation: `wave-bar ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
              {hifzMode ? "Recite from memory…" : "AI is listening… recite now"}
            </span>
          </div>
          <button onClick={stopListening} className="px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, fontWeight: 600 }}>Stop</button>
        </div>
      )}

      {/* Bismillah */}
      {selectedSurah.number !== 9 && (
        <div className="py-5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-arabic" style={{ fontSize: 22, color: "#F0D080" }}>بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
        </div>
      )}

      {/* Ayah List */}
      <div>
        {loadingAyahs
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton className="h-4 w-8 mb-3" /><Skeleton className="h-6 w-full mb-2" /><Skeleton className="h-4 w-3/4" />
              </div>
            ))
          : ayahs.map((ayah, idx) => {
              const isActive = idx === activeAyahIdx && listening;
              const hasResult = result && result.ayahIdx === idx;
              const isMemorized = hifzRecords[ayah.numberInSurah]?.memorized;
              const isPeeking = peekingAyah === ayah.numberInSurah;
              const peekCount = peekCounts[ayah.numberInSurah] || 0;

              // Hifz mode: determine what to show
              const hideText = hifzMode && !isPeeking && !hasResult;
              const showHint = hifzMode && difficulty === "easy" && !isPeeking && !hasResult;
              const hideNumber = hifzMode && difficulty === "hard";
              const firstWord = ayah.text.split(/\s+/)[0] || "";

              return (
                <div key={ayah.number} className="px-5 py-4 transition-all" style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  ...(isActive ? { borderLeft: "3px solid #C9A84C", background: "rgba(201,168,76,0.06)" } : {}),
                  ...(hasResult ? { borderLeft: "3px solid #25A566", background: "rgba(37,165,102,0.04)" } : {}),
                  ...(isMemorized && hifzMode ? { borderLeft: "3px solid #25A566" } : {}),
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {!hideNumber && (
                        <div className="flex items-center justify-center font-bold" style={{ width: 26, height: 26, borderRadius: 7, background: isMemorized ? "#25A566" : "#0D4D2E", color: "#fff", fontSize: 11 }}>
                          {isMemorized ? "✓" : ayah.numberInSurah}
                        </div>
                      )}
                      {isActive && <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: "rgba(201,168,76,0.2)", color: "#C9A84C", fontWeight: 600 }}>Recite this ayah</span>}
                      {hifzMode && !isActive && !hasResult && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Recite from memory</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hifzMode && (
                        <button
                          onMouseDown={() => handlePeekStart(ayah.numberInSurah)}
                          onMouseUp={handlePeekEnd}
                          onMouseLeave={handlePeekEnd}
                          onTouchStart={() => handlePeekStart(ayah.numberInSurah)}
                          onTouchEnd={handlePeekEnd}
                          className="flex items-center justify-center rounded-full"
                          style={{ width: 28, height: 28, background: isPeeking ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.07)" }}
                        >
                          <Eye size={14} style={{ color: isPeeking ? "#C9A84C" : "#fff" }} />
                        </button>
                      )}
                      <button onClick={() => { setActiveAyahIdx(idx); setResult(null); }} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: idx === activeAyahIdx ? "rgba(37,165,102,0.2)" : "rgba(255,255,255,0.07)" }}>
                        <Mic size={14} style={{ color: idx === activeAyahIdx ? "#25A566" : "#fff" }} />
                      </button>
                      {!hifzMode && [Play, Bookmark, Share2].map((Icon, i) => (
                        <button key={i} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}>
                          <Icon size={14} className="text-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Arabic text */}
                  {hasResult ? (
                    <p className="font-arabic text-right flex flex-wrap justify-end gap-1" dir="rtl" style={{ fontSize: 21, lineHeight: 1.85 }}>
                      {result!.words.map((w, wi) => (
                        <span key={wi} style={{ color: w.status === "correct" ? "#25A566" : w.status === "wrong" ? "#ef4444" : "#f59e0b", textDecoration: w.status === "wrong" ? "underline" : "none" }}>{w.word}</span>
                      ))}
                    </p>
                  ) : hideText ? (
                    <div className="text-right" dir="rtl">
                      {showHint && (
                        <span className="font-arabic" style={{ fontSize: 21, color: "rgba(240,208,128,0.5)" }}>{firstWord} ...</span>
                      )}
                      <div className="flex flex-col gap-2 mt-1">
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="rounded" style={{ height: 14, background: "rgba(255,255,255,0.04)", width: i === 0 ? "100%" : "70%" }} />
                        ))}
                      </div>
                      {peekCount > 0 && (
                        <p className="mt-1" style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "left" }}>Peeked {peekCount} time{peekCount > 1 ? "s" : ""}</p>
                      )}
                    </div>
                  ) : (
                    <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 21, lineHeight: 1.85, color: "#F0D080" }}>{ayah.text}</p>
                  )}

                  {!hifzMode && !hideText && (
                    <p className="mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{ayah.translation}</p>
                  )}

                  {/* Result card */}
                  {hasResult && (
                    <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: 13, fontWeight: 700, color: result!.score === result!.total ? "#25A566" : "#ef4444" }}>
                          {result!.score === result!.total ? `Masha'Allah! ${result!.score}/${result!.total} correct ✅` : `${result!.total - result!.score} mistake${result!.total - result!.score > 1 ? "s" : ""} found ❌`}
                        </span>
                        <button onClick={() => { setResult(null); startListening(); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>
                          <RotateCcw size={12} /> Try Again
                        </button>
                      </div>
                      {result!.words.filter(w => w.status !== "correct").map((w, i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                          <div className="flex-1">
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{w.status === "skipped" ? "Skipped:" : "You said:"}</span>
                            <span className="font-arabic ml-2" style={{ fontSize: 15, color: w.status === "wrong" ? "#ef4444" : "#f59e0b" }}>{w.spoken || "—"}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Correct:</span>
                            <span className="font-arabic ml-2" style={{ fontSize: 15, color: "#25A566" }}>{w.word}</span>
                          </div>
                        </div>
                      ))}

                      {/* Mark as memorized button */}
                      {hifzMode && result!.score === result!.total && !isMemorized && (
                        <button onClick={() => markMemorized(ayah.numberInSurah)} className="w-full mt-2 py-2 rounded-xl flex items-center justify-center gap-2" style={{ background: "rgba(37,165,102,0.15)", color: "#25A566", fontSize: 12, fontWeight: 600, border: "1px solid rgba(37,165,102,0.2)" }}>
                          <CheckCircle size={14} /> Mark as Memorized
                        </button>
                      )}

                      {result!.score === result!.total && activeAyahIdx < ayahs.length - 1 && (
                        <p className="text-center mt-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Auto-advancing to next ayah…</p>
                      )}
                    </div>
                  )}

                  {/* Mark memorized (no result, hifz mode) */}
                  {hifzMode && !hasResult && !isMemorized && (
                    <button onClick={() => markMemorized(ayah.numberInSurah)} className="mt-2 py-1.5 px-3 rounded-full flex items-center gap-1.5" style={{ background: "rgba(37,165,102,0.1)", color: "#25A566", fontSize: 11, fontWeight: 600 }}>
                      <CheckCircle size={12} /> Mark as Memorized
                    </button>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
};

export default QuranScreen;
