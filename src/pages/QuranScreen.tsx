import { useState, useEffect } from "react";
import { ChevronLeft, Mic, Play, Bookmark, Share2, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  translation: string;
}

interface QuranScreenProps {
  onBack: () => void;
}

const CACHE_PREFIX = "quran_surah_";

const QuranScreen = ({ onBack }: QuranScreenProps) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [listening, setListening] = useState(false);

  // Fetch surah list
  useEffect(() => {
    const cached = localStorage.getItem("quran_surah_list");
    if (cached) {
      setSurahs(JSON.parse(cached));
      setLoadingSurahs(false);
      return;
    }
    fetch("https://api.alquran.cloud/v1/surah")
      .then((r) => r.json())
      .then((d) => {
        setSurahs(d.data);
        localStorage.setItem("quran_surah_list", JSON.stringify(d.data));
      })
      .finally(() => setLoadingSurahs(false));
  }, []);

  // Fetch ayahs for selected surah
  useEffect(() => {
    if (!selectedSurah) return;
    const key = CACHE_PREFIX + selectedSurah.number;
    const cached = localStorage.getItem(key);
    if (cached) {
      setAyahs(JSON.parse(cached));
      setLoadingAyahs(false);
      return;
    }
    setLoadingAyahs(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah.number}/editions/quran-uthmani,en.asad`)
      .then((r) => r.json())
      .then((d) => {
        const arabic = d.data[0].ayahs;
        const english = d.data[1].ayahs;
        const merged: Ayah[] = arabic.map((a: any, i: number) => ({
          number: a.number,
          numberInSurah: a.numberInSurah,
          text: a.text,
          translation: english[i]?.text || "",
        }));
        setAyahs(merged);
        localStorage.setItem(key, JSON.stringify(merged));
      })
      .finally(() => setLoadingAyahs(false));
  }, [selectedSurah]);

  // --- SURAH LIST ---
  if (!selectedSurah) {
    return (
      <div className="min-h-screen">
        <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
          <div className="flex items-center justify-between px-5 py-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}
            >
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
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))
            : surahs.map((s) => (
                <button
                  key={s.number}
                  onClick={() => setSelectedSurah(s)}
                  className="flex items-center gap-3 w-full text-left py-3 active:scale-[0.98] transition-transform"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div
                    className="flex items-center justify-center font-bold shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "#0D4D2E",
                      color: "#25A566",
                      fontSize: 13,
                    }}
                  >
                    {s.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-foreground font-semibold" style={{ fontSize: 14 }}>{s.englishName}</p>
                      <p className="font-arabic" style={{ fontSize: 18, color: "#C9A84C" }}>{s.name}</p>
                    </div>
                    <p className="text-muted-foreground" style={{ fontSize: 11 }}>
                      {s.englishNameTranslation} · {s.numberOfAyahs} Ayaat · {s.revelationType === "Meccan" ? "Makki" : "Madani"}
                    </p>
                  </div>
                </button>
              ))}
        </div>
      </div>
    );
  }

  // --- SURAH DETAIL ---
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => { setSelectedSurah(null); setAyahs([]); }}
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{selectedSurah.englishName}</h2>
          <button
            onClick={() => setListening(!listening)}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: "#C9A84C",
              ...(listening ? { animation: "pulse-gold 1.5s ease infinite" } : {}),
            }}
          >
            <Mic size={18} style={{ color: "#0A0F0D" }} />
          </button>
        </div>

        <div
          className="mx-5 flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(0,0,0,0.3)", borderRadius: "16px 16px 0 0" }}
        >
          <p className="font-arabic" style={{ fontSize: 22, color: "#C9A84C" }}>{selectedSurah.name}</p>
          <div className="text-right">
            <p className="text-foreground" style={{ fontSize: 13 }}>{selectedSurah.englishNameTranslation}</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>
              {selectedSurah.numberOfAyahs} Ayaat · {selectedSurah.revelationType === "Meccan" ? "Makki" : "Madani"}
            </p>
          </div>
        </div>
      </div>

      {/* Listening Bar */}
      {listening && (
        <div
          className="mx-5 mt-3 flex items-center justify-between px-4 py-3"
          style={{ background: "linear-gradient(135deg, #0D4D2E, #1A7A4A)", borderRadius: 16 }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5" style={{ height: 24 }}>
              {[12, 20, 8, 16, 24].map((_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 3,
                    background: "#25A566",
                    animation: `wave-bar ${0.8 + i * 0.15}s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>AI is listening… recite now</span>
          </div>
          <button
            onClick={() => setListening(false)}
            className="px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, fontWeight: 600 }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Bismillah (skip for At-Tawbah) */}
      {selectedSurah.number !== 9 && (
        <div className="py-5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-arabic" style={{ fontSize: 22, color: "#F0D080" }}>
            بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
          </p>
        </div>
      )}

      {/* Ayah List */}
      <div>
        {loadingAyahs
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton className="h-4 w-8 mb-3" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          : ayahs.map((ayah) => (
              <div
                key={ayah.number}
                className="px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="flex items-center justify-center font-bold"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: "#0D4D2E",
                      color: "#fff",
                      fontSize: 11,
                    }}
                  >
                    {ayah.numberInSurah}
                  </div>
                  <div className="flex items-center gap-2">
                    {[Play, Bookmark, Share2].map((Icon, i) => (
                      <button
                        key={i}
                        className="flex items-center justify-center rounded-full"
                        style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}
                      >
                        <Icon size={14} className="text-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 21, lineHeight: 1.85, color: "#F0D080" }}>
                  {ayah.text}
                </p>
                <p className="mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  {ayah.translation}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
};

export default QuranScreen;
