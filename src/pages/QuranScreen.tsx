import { ChevronLeft, Mic, Play, Bookmark, Share2 } from "lucide-react";
import { useState } from "react";

interface QuranScreenProps {
  onBack: () => void;
}

const ayahs = [
  {
    number: 1,
    arabic: "بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ",
    translation: "In the name of Allah, the Most Gracious, the Most Merciful.",
    highlighted: false,
  },
  {
    number: 1,
    arabic: "الٓمٓ",
    translation: "Alif, Lam, Meem.",
    highlighted: true,
  },
  {
    number: 2,
    arabic: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ",
    translation: "This is the Book about which there is no doubt, a guidance for those conscious of Allah.",
    highlighted: false,
  },
  {
    number: 3,
    arabic: "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ",
    translation: "Who believe in the unseen, establish prayer, and spend out of what We have provided for them.",
    highlighted: false,
  },
  {
    number: 4,
    arabic: "وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ",
    translation: "And who believe in what has been revealed to you and what was revealed before you, and of the Hereafter they are certain.",
    highlighted: false,
  },
];

const QuranScreen = ({ onBack }: QuranScreenProps) => {
  const [listening, setListening] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 59 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Al-Baqarah</h2>
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

        {/* Surah Info */}
        <div
          className="mx-5 flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(0,0,0,0.3)", borderRadius: "16px 16px 0 0" }}
        >
          <p className="font-arabic" style={{ fontSize: 22, color: "#C9A84C" }}>سُورَةُ الْبَقَرَة</p>
          <div className="text-right">
            <p className="text-foreground" style={{ fontSize: 13 }}>The Cow</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>286 Ayaat · Madani</p>
          </div>
        </div>
      </div>

      {/* Listening Bar */}
      {listening && (
        <div
          className="mx-5 mt-3 flex items-center justify-between px-4 py-3"
          style={{
            background: "linear-gradient(135deg, #0D4D2E, #1A7A4A)",
            borderRadius: 16,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5" style={{ height: 24 }}>
              {[12, 20, 8, 16, 24].map((h, i) => (
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

      {/* Bismillah */}
      <div className="py-5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="font-arabic" style={{ fontSize: 22, color: "#F0D080" }}>
          بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
        </p>
      </div>

      {/* Ayah List */}
      <div>
        {ayahs.slice(1).map((ayah, idx) => (
          <div
            key={idx}
            className="px-5 py-4"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              ...(ayah.highlighted
                ? { borderLeft: "3px solid #C9A84C", background: "rgba(201,168,76,0.06)" }
                : {}),
            }}
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
                {ayah.number}
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
            <p className="font-arabic text-right text-foreground" dir="rtl" style={{ fontSize: 21, lineHeight: 1.85 }}>
              {ayah.arabic}
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
