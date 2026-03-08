import { ChevronLeft, Mic, Volume2, Bookmark, Share2, Search } from "lucide-react";
import { useState } from "react";

interface HadithScreenProps {
  onBack: () => void;
}

const books = ["All Books", "Bukhari", "Muslim", "Abu Dawood", "Tirmizi", "Nasa'i", "Ibn Majah"];

const hadiths = [
  {
    book: "BUKHARI",
    grading: { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" },
    arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    narrator: "Narrated by Umar ibn Al-Khattab (RA)",
    english: "Actions are judged by intentions, and every person shall have what they intended.",
    topics: ["Intentions", "Sincerity"],
  },
  {
    book: "MUSLIM",
    grading: { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" },
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    narrator: "Narrated by Anas ibn Malik (RA)",
    english: "None of you truly believes until he loves for his brother what he loves for himself.",
    topics: ["Brotherhood", "Faith"],
  },
  {
    book: "BUKHARI",
    grading: { label: "Sahih", color: "#25A566", bg: "rgba(37,165,102,0.15)" },
    arabic: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ",
    narrator: "Narrated by Abu Hurairah (RA)",
    english: "Whoever believes in Allah and the Last Day, let him speak good or remain silent.",
    topics: ["Speech", "Manners"],
  },
];

const HadithScreen = ({ onBack }: HadithScreenProps) => {
  const [activeBook, setActiveBook] = useState("All Books");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #0F0800, #3D1A00)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Hadith Library</h2>
          <button
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "#C9A84C" }}
          >
            <Mic size={18} style={{ color: "#0A0F0D" }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-4">
          <div
            className="flex items-center gap-2 px-4"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              height: 44,
            }}
          >
            <Search size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", flex: 1 }}>Search by topic, text, or recite…</span>
            <Mic size={16} style={{ color: "#C9A84C" }} />
          </div>
        </div>
      </div>

      {/* Book Chips */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none">
        {books.map((book) => (
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
            {book}
          </button>
        ))}
      </div>

      {/* Hadith Cards */}
      <div className="px-4 pb-4">
        {hadiths.map((h, idx) => (
          <div
            key={idx}
            className="mb-3.5 active:scale-[0.98] transition-transform"
            style={{
              background: "#111A14",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="font-bold uppercase" style={{ fontSize: 11, color: "#C9A84C", letterSpacing: 1 }}>
                {h.book}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full font-semibold"
                style={{ fontSize: 10, background: h.grading.bg, color: h.grading.color }}
              >
                ✅ {h.grading.label}
              </span>
            </div>
            <p className="font-arabic text-right px-4 mt-2" dir="rtl" style={{ fontSize: 18, color: "#F0D080", lineHeight: 1.8 }}>
              {h.arabic}
            </p>
            <p className="px-4 mt-1 italic" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              {h.narrator}
            </p>
            <p className="px-4 mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
              {h.english}
            </p>
            <div
              className="flex items-center justify-between px-4 py-3 mt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex gap-1.5">
                {h.topics.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full font-semibold"
                    style={{ fontSize: 10, background: "rgba(201,168,76,0.12)", color: "#C9A84C" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                {[Volume2, Bookmark, Share2].map((Icon, i) => (
                  <button key={i} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)" }}>
                    <Icon size={14} className="text-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HadithScreen;
