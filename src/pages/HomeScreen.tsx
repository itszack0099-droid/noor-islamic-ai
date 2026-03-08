import { Bell, BookOpen, ScrollText, Bot, ChevronRight, Check, Star, Share2 } from "lucide-react";

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

const prayers = [
  { name: "Fajr", time: "5:12", active: false },
  { name: "Dhuhr", time: "1:15", active: true },
  { name: "Asr", time: "4:42", active: false },
  { name: "Maghrib", time: "7:28", active: false },
  { name: "Isha", time: "8:55", active: false },
];

const streakDays = [
  { label: "M", done: true },
  { label: "T", done: true },
  { label: "W", done: true },
  { label: "T", done: true },
  { label: "F", today: true },
  { label: "S", done: false },
  { label: "S", done: false },
];

const HomeScreen = ({ onNavigate }: HomeScreenProps) => {
  return (
    <div className="px-5" style={{ paddingTop: 70 }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-arabic text-accent" style={{ fontSize: 14 }}>
            السلام عليكم ورحمة الله
          </p>
          <h1 className="text-foreground font-bold mt-1" style={{ fontSize: 28 }}>
            Ahmad! 👋
          </h1>
        </div>
        <button
          className="flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)" }}
        >
          <Bell size={18} className="text-foreground" />
        </button>
      </div>

      {/* Prayer Times */}
      <div
        className="mt-5"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "14px 18px",
        }}
      >
        <div className="flex items-center justify-between">
          {prayers.map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                {p.active && (
                  <span
                    className="rounded-full"
                    style={{ width: 6, height: 6, background: "#25A566" }}
                  />
                )}
                <span
                  className="font-semibold"
                  style={{
                    fontSize: 11,
                    color: p.active ? "#25A566" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {p.name}
                </span>
              </div>
              <span
                className="font-bold"
                style={{
                  fontSize: 14,
                  color: p.active ? "#25A566" : "rgba(255,255,255,0.8)",
                }}
              >
                {p.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ayah of the Day */}
      <div
        className="mt-4"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 24,
          padding: 20,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full" style={{ width: 6, height: 6, background: "#C9A84C" }} />
          <span className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            Ayah of the Day
          </span>
        </div>
        <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 24, color: "#F0D080", lineHeight: 1.8 }}>
          إِنَّ مَعَ الْعُسْرِ يُسْرًا
        </p>
        <p className="mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
          Verily, with every difficulty comes ease.
        </p>
        <div className="flex items-center justify-between mt-4">
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Al-Inshirah 94:6</span>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ border: "1px solid #C9A84C", color: "#C9A84C", fontSize: 12, fontWeight: 600 }}
          >
            Share <Share2 size={12} />
          </button>
        </div>
      </div>

      {/* Streak */}
      <div className="mt-5">
        <span className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
          🔥 7-Day Streak
        </span>
        <div className="flex items-center justify-between mt-3 gap-2">
          {streakDays.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center font-semibold"
              style={{
                width: 40,
                height: 48,
                borderRadius: 10,
                fontSize: 11,
                background: d.today
                  ? "#25A566"
                  : d.done
                  ? "#C9A84C"
                  : "rgba(255,255,255,0.06)",
                color: d.done || d.today ? "#fff" : "rgba(255,255,255,0.3)",
                ...(d.today ? { animation: "pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}),
              }}
            >
              <span style={{ fontSize: 10, marginBottom: 2 }}>{d.label}</span>
              {d.done && <Check size={14} />}
              {d.today && <Star size={14} fill="white" />}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={() => onNavigate("quran")}
          className="text-left p-4 active:scale-[0.96] transition-transform"
          style={{
            background: "linear-gradient(135deg, #1A2820, #0D4D2E)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
          }}
        >
          <BookOpen size={24} className="text-primary mb-2" />
          <p className="text-foreground font-bold" style={{ fontSize: 15 }}>Quran</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Al-Baqarah • Ayah 45</p>
          <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: "34%", background: "#25A566" }} />
          </div>
        </button>

        <button
          onClick={() => onNavigate("hadith")}
          className="text-left p-4 active:scale-[0.96] transition-transform"
          style={{
            background: "linear-gradient(135deg, #1A1008, #3D1A00)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
          }}
        >
          <ScrollText size={24} className="text-accent mb-2" />
          <p className="text-foreground font-bold" style={{ fontSize: 15 }}>Hadith</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Bukhari • 1,124 read</p>
          <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: "18%", background: "#C9A84C" }} />
          </div>
        </button>
      </div>

      {/* AI Banner */}
      <button
        onClick={() => onNavigate("ai")}
        className="w-full flex items-center gap-3 mt-3 mb-4 active:scale-[0.98] transition-transform"
        style={{
          background: "rgba(109,40,217,0.12)",
          border: "1px solid rgba(109,40,217,0.25)",
          borderRadius: 20,
          padding: 18,
        }}
      >
        <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "linear-gradient(135deg, #4C1D95, #6D28D9)" }}>
          <Bot size={22} className="text-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-foreground font-bold" style={{ fontSize: 15 }}>NoorAI Scholar</p>
          <p className="text-muted-foreground" style={{ fontSize: 12 }}>Ask anything about Quran & Hadith</p>
        </div>
        <ChevronRight size={18} style={{ color: "rgba(255,255,255,0.2)" }} />
      </button>
    </div>
  );
};

export default HomeScreen;
