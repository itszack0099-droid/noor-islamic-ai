import { Search, Mic, MicOff, Loader2, ShieldCheck } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import VerifyHadith from "@/components/VerifyHadith";

interface SearchResult {
  type: "Quran" | "Hadith";
  arabic: string;
  translation: string;
  reference: string;
}

const filters = [
  { id: "all", label: "All" },
  { id: "quran", label: "Quran" },
  { id: "hadith", label: "Hadith" },
];

const HADITH_BOOKS = [
  { name: "Bukhari", key: "bukhari" },
  { name: "Muslim", key: "muslim" },
  { name: "Abu Dawood", key: "abudawud" },
  { name: "Tirmizi", key: "tirmizi" },
  { name: "Nasai", key: "nasai" },
  { name: "Ibn Majah", key: "ibnmajah" },
];

type ScreenMode = "search" | "verify";

const SearchScreen = () => {
  const [mode, setMode] = useState<ScreenMode>("search");
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [listening, setListening] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);

    const all: SearchResult[] = [];

    try {
      const res = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/en.asad`);
      const data = await res.json();
      if (data.data?.matches) {
        for (const m of data.data.matches.slice(0, 20)) {
          all.push({
            type: "Quran",
            arabic: m.text || "",
            translation: m.edition?.identifier === "en.asad" ? m.text : "",
            reference: `${m.surah?.englishName || ""} ${m.surah?.number || ""}:${m.numberInSurah || ""}`,
          });
        }
      }
    } catch { /* ignore */ }

    for (const book of HADITH_BOOKS) {
      const cacheKey = `hadith_${book.key}_1`;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) continue;
      try {
        const items: any[] = JSON.parse(cached);
        const lq = q.toLowerCase();
        for (const h of items) {
          const eng = (h.english || "").toLowerCase();
          const arb = h.arabic || "";
          if (eng.includes(lq) || arb.includes(q)) {
            all.push({
              type: "Hadith",
              arabic: arb,
              translation: h.english || "",
              reference: `${book.name} #${h.hadithNumber}`,
            });
          }
        }
      } catch { /* ignore */ }
    }

    setResults(all);
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setQuery(text);
      setListening(false);
      doSearch(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const filtered = activeFilter === "all" ? results : results.filter((r) => r.type.toLowerCase() === activeFilter);

  return (
    <div style={{ paddingTop: 12, background: "#000", minHeight: "100vh" }}>
      {/* Mode Tabs */}
      <div className="flex gap-2 px-5 pt-3">
        <button
          onClick={() => setMode("search")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all"
          style={{
            fontSize: 13,
            background: mode === "search" ? "rgba(37,165,102,0.15)" : "rgba(255,255,255,0.05)",
            color: mode === "search" ? "#25A566" : "rgba(255,255,255,0.4)",
            border: `1px solid ${mode === "search" ? "rgba(37,165,102,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <Search size={16} />
          Search
        </button>
        <button
          onClick={() => setMode("verify")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all"
          style={{
            fontSize: 13,
            background: mode === "verify" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)",
            color: mode === "verify" ? "#C9A84C" : "rgba(255,255,255,0.4)",
            border: `1px solid ${mode === "verify" ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <ShieldCheck size={16} />
          🔍 Verify Hadith
        </button>
      </div>

      {mode === "verify" ? (
        <VerifyHadith />
      ) : (
        <>
          {/* Search Bar */}
          <div className="px-5 pt-3">
            <div className="flex items-center gap-2 px-4" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, height: 48 }}>
              <Search size={18} style={{ color: "rgba(255,255,255,0.4)" }} />
              <input
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                placeholder="Search Quran, Hadith…"
                style={{ fontSize: 14 }}
              />
              <button onClick={handleVoice}>
                {listening ? <MicOff size={18} style={{ color: "#ef4444" }} /> : <Mic size={18} style={{ color: "#C9A84C" }} />}
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className="shrink-0 px-4 py-2 rounded-full font-semibold transition-all"
                style={{ fontSize: 12, background: activeFilter === f.id ? "#25A566" : "rgba(255,255,255,0.07)", color: activeFilter === f.id ? "#fff" : "rgba(255,255,255,0.6)" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="px-5">
            {loading ? (
              <div className="flex flex-col gap-3 mt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16 }}>
                    <Skeleton className="h-3 w-16 mb-3" />
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : searched && filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="font-arabic" style={{ fontSize: 28, color: "#C9A84C" }}>لا نتائج</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>No results found</p>
              </div>
            ) : filtered.length > 0 ? (
              <>
                <span className="uppercase font-semibold" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
                  {filtered.length} Result{filtered.length !== 1 ? "s" : ""}
                </span>
                <div className="mt-3 flex flex-col gap-3">
                  {filtered.map((r, idx) => (
                    <div key={idx} className="p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full font-semibold" style={{
                          fontSize: 10,
                          background: r.type === "Quran" ? "rgba(37,165,102,0.15)" : "rgba(201,168,76,0.15)",
                          color: r.type === "Quran" ? "#25A566" : "#C9A84C",
                        }}>
                          {r.type}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{r.reference}</span>
                      </div>
                      {r.arabic && (
                        <p className="font-arabic text-right mt-2" dir="rtl" style={{ fontSize: 18, color: r.type === "Quran" ? "#F0F4F0" : "#F0D080", lineHeight: 1.8 }}>
                          {r.arabic}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                        {r.translation}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : !searched ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Search size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Search the Quran & Hadith</p>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchScreen;
