import { Search, Mic } from "lucide-react";
import { useState } from "react";

const filters = [
  { id: "all", label: "All" },
  { id: "quran", label: "Quran" },
  { id: "hadith", label: "Hadith" },
  { id: "duas", label: "Duas" },
  { id: "tafseer", label: "Tafseer" },
];

const results = [
  {
    type: "Quran",
    badge: { bg: "rgba(37,165,102,0.15)", color: "#25A566" },
    arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Verily, with every difficulty comes ease. — Al-Inshirah 94:6",
  },
  {
    type: "Hadith",
    badge: { bg: "rgba(201,168,76,0.15)", color: "#C9A84C" },
    arabic: "الدُّعَاءُ هُوَ الْعِبَادَةُ",
    translation: "Supplication is the essence of worship. — Tirmidhi",
  },
  {
    type: "Quran",
    badge: { bg: "rgba(37,165,102,0.15)", color: "#25A566" },
    arabic: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ",
    translation: "And when My servants ask you about Me, indeed I am near. — Al-Baqarah 2:186",
  },
  {
    type: "Hadith",
    badge: { bg: "rgba(201,168,76,0.15)", color: "#C9A84C" },
    arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    translation: "The best of you are those who learn the Quran and teach it. — Bukhari",
  },
];

const SearchScreen = () => {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div style={{ paddingTop: 12, background: "#000", minHeight: "100vh" }}>
      {/* Search Bar */}
      <div className="px-5 pt-3">
        <div
          className="flex items-center gap-2 px-4"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            height: 48,
          }}
        >
          <Search size={18} style={{ color: "rgba(255,255,255,0.4)" }} />
          <input
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            placeholder="Search Quran, Hadith, Duas…"
            style={{ fontSize: 14 }}
          />
          <Mic size={18} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className="shrink-0 px-4 py-2 rounded-full font-semibold transition-all"
            style={{
              fontSize: 12,
              background: activeFilter === f.id ? "#25A566" : "rgba(255,255,255,0.07)",
              color: activeFilter === f.id ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="px-5">
        <span className="uppercase font-semibold" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
          Results
        </span>
        <div className="mt-3 flex flex-col gap-3">
          {results.map((r, idx) => (
            <div
              key={idx}
              className="p-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
              }}
            >
              <span
                className="px-2.5 py-0.5 rounded-full font-semibold"
                style={{ fontSize: 10, background: r.badge.bg, color: r.badge.color }}
              >
                {r.type}
              </span>
              <p className="font-arabic text-right text-foreground mt-2" dir="rtl" style={{ fontSize: 18, lineHeight: 1.8 }}>
                {r.arabic}
              </p>
              <p className="mt-1" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                {r.translation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchScreen;
