import { Bell, BookOpen, ScrollText, Bot, ChevronRight, Check, Star, Share2, MapPin, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

interface PrayerTime {
  name: string;
  time: string;
  active: boolean;
}

const streakDays = [
  { label: "M", done: true },
  { label: "T", done: true },
  { label: "W", done: true },
  { label: "T", done: true },
  { label: "F", today: true },
  { label: "S", done: false },
  { label: "S", done: false },
];

function to24(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function computeActive(timings: Record<string, string>): { prayers: PrayerTime[]; nextLabel: string; nextIn: string } {
  const keys = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const pts = keys.map((k) => ({
    name: k,
    time: (timings[k] || "").replace(/ \(.*\)/, ""),
    mins: to24((timings[k] || "0:0").replace(/ \(.*\)/, "")),
  }));

  // Find current active prayer (the last prayer whose time has passed)
  let activeIdx = -1;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (nowMins >= pts[i].mins) { activeIdx = i; break; }
  }

  // Next prayer
  let nextIdx = pts.findIndex((p) => p.mins > nowMins);
  let nextIn = 0;
  let nextLabel = "";
  if (nextIdx === -1) {
    // After Isha — next is tomorrow's Fajr
    nextLabel = "Fajr";
    nextIn = 24 * 60 - nowMins + pts[0].mins;
  } else {
    nextLabel = pts[nextIdx].name;
    nextIn = pts[nextIdx].mins - nowMins;
  }

  return {
    prayers: pts.map((p, i) => ({ name: p.name, time: p.time, active: i === activeIdx })),
    nextLabel,
    nextIn: formatCountdown(nextIn),
  };
}

const HomeScreen = ({ onNavigate }: HomeScreenProps) => {
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState({ label: "", time: "" });
  const [locationDenied, setLocationDenied] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [loadingPrayer, setLoadingPrayer] = useState(true);

  const fetchTimings = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=2`);
      const data = await res.json();
      const timings = data.data?.timings;
      if (!timings) return;
      const { prayers: p, nextLabel, nextIn } = computeActive(timings);
      setPrayers(p);
      setNextPrayer({ label: nextLabel, time: nextIn });
    } catch { /* fallback */ }
    setLoadingPrayer(false);
  };

  const fetchByCity = async (city: string) => {
    if (!city.trim()) return;
    setLoadingPrayer(true);
    try {
      const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=&method=2`);
      const data = await res.json();
      const timings = data.data?.timings;
      if (!timings) { setLoadingPrayer(false); return; }
      const { prayers: p, nextLabel, nextIn } = computeActive(timings);
      setPrayers(p);
      setNextPrayer({ label: nextLabel, time: nextIn });
    } catch { /* */ }
    setLoadingPrayer(false);
  };

  useEffect(() => {
    if (!navigator.geolocation) { setLocationDenied(true); setLoadingPrayer(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchTimings(pos.coords.latitude, pos.coords.longitude),
      () => { setLocationDenied(true); setLoadingPrayer(false); },
      { timeout: 8000 }
    );
  }, []);

  return (
    <div className="px-5 pt-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-arabic text-accent" style={{ fontSize: 14 }}>السلام عليكم ورحمة الله</p>
          <h1 className="text-foreground font-bold mt-1" style={{ fontSize: 28 }}>Ahmad! 👋</h1>
        </div>
        <button className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)" }}>
          <Bell size={18} className="text-foreground" />
        </button>
      </div>

      {/* Prayer Times */}
      <div className="mt-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "14px 18px" }}>
        {locationDenied && prayers.length === 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MapPin size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Enter your city for prayer times</span>
            </div>
            <div className="flex gap-2">
              <input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchByCity(cityQuery)}
                placeholder="e.g. London, Dubai, Karachi"
                className="flex-1 bg-transparent outline-none px-3 py-2"
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, fontSize: 13, color: "#F0F4F0", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <button onClick={() => fetchByCity(cityQuery)} className="px-3 rounded-lg" style={{ background: "#25A566", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                <Search size={16} />
              </button>
            </div>
          </div>
        ) : loadingPrayer ? (
          <div className="flex items-center justify-center py-2 gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "#25A566" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Fetching prayer times…</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              {prayers.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    {p.active && <span className="rounded-full" style={{ width: 6, height: 6, background: "#25A566" }} />}
                    <span className="font-semibold" style={{ fontSize: 11, color: p.active ? "#25A566" : "rgba(255,255,255,0.5)" }}>{p.name}</span>
                  </div>
                  <span className="font-bold" style={{ fontSize: 14, color: p.active ? "#25A566" : "rgba(255,255,255,0.8)" }}>{p.time}</span>
                </div>
              ))}
            </div>
            {nextPrayer.label && (
              <p className="text-center mt-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                Next: <span style={{ color: "#25A566", fontWeight: 600 }}>{nextPrayer.label}</span> in {nextPrayer.time}
              </p>
            )}
          </>
        )}
      </div>

      {/* Ayah of the Day */}
      <div className="mt-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 20 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full" style={{ width: 6, height: 6, background: "#C9A84C" }} />
          <span className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>Ayah of the Day</span>
        </div>
        <p className="font-arabic text-right" dir="rtl" style={{ fontSize: 24, color: "#F0D080", lineHeight: 1.8 }}>إِنَّ مَعَ الْعُسْرِ يُسْرًا</p>
        <p className="mt-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Verily, with every difficulty comes ease.</p>
        <div className="flex items-center justify-between mt-4">
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Al-Inshirah 94:6</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ border: "1px solid #C9A84C", color: "#C9A84C", fontSize: 12, fontWeight: 600 }}>
            Share <Share2 size={12} />
          </button>
        </div>
      </div>

      {/* Streak */}
      <div className="mt-5">
        <span className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>🔥 7-Day Streak</span>
        <div className="flex items-center justify-between mt-3 gap-2">
          {streakDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-center font-semibold" style={{ width: 40, height: 48, borderRadius: 10, fontSize: 11, background: d.today ? "#25A566" : d.done ? "#C9A84C" : "rgba(255,255,255,0.06)", color: d.done || d.today ? "#fff" : "rgba(255,255,255,0.3)", ...(d.today ? { animation: "pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}) }}>
              <span style={{ fontSize: 10, marginBottom: 2 }}>{d.label}</span>
              {d.done && <Check size={14} />}
              {d.today && <Star size={14} fill="white" />}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={() => onNavigate("quran")} className="text-left p-4 active:scale-[0.96] transition-transform" style={{ background: "linear-gradient(135deg, #1A2820, #0D4D2E)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20 }}>
          <BookOpen size={24} className="text-primary mb-2" />
          <p className="text-foreground font-bold" style={{ fontSize: 15 }}>Quran</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Al-Baqarah • Ayah 45</p>
          <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: "34%", background: "#25A566" }} />
          </div>
        </button>
        <button onClick={() => onNavigate("hadith")} className="text-left p-4 active:scale-[0.96] transition-transform" style={{ background: "linear-gradient(135deg, #1A1008, #3D1A00)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20 }}>
          <ScrollText size={24} className="text-accent mb-2" />
          <p className="text-foreground font-bold" style={{ fontSize: 15 }}>Hadith</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Bukhari • 1,124 read</p>
          <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: "18%", background: "#C9A84C" }} />
          </div>
        </button>
      </div>

      {/* AI Banner */}
      <button onClick={() => onNavigate("ai")} className="w-full flex items-center gap-3 mt-3 mb-4 active:scale-[0.98] transition-transform" style={{ background: "rgba(109,40,217,0.12)", border: "1px solid rgba(109,40,217,0.25)", borderRadius: 20, padding: 18 }}>
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
