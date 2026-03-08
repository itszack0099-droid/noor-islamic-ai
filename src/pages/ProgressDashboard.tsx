import { useState, useEffect } from "react";
import { ChevronLeft, BookOpen, Flame, Trophy, Lock, ArrowRight, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressDashboardProps {
  onBack: () => void;
  onNavigate: (tab: string) => void;
}

const TOTAL_QURAN_AYAHS = 6236;
const JUZ_AYAHS = [0, 148, 259, 385, 516, 640, 750, 899, 1041, 1200, 1327, 1478, 1585, 1707, 1840, 1901, 2029, 2140, 2250, 2348, 2483, 2595, 2673, 2791, 2932, 3060, 3159, 3252, 3340, 3510, 3604, 6236];

interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  requirement: number;
  check: (stats: any) => boolean;
}

const BADGES: Badge[] = [
  { id: "first_ayah", icon: "📖", name: "First Step", desc: "Read your first ayah", requirement: 1, check: (s) => s.totalAyahs >= 1 },
  { id: "100_ayahs", icon: "🌟", name: "Century", desc: "Read 100 ayahs", requirement: 100, check: (s) => s.totalAyahs >= 100 },
  { id: "500_ayahs", icon: "🏆", name: "Scholar", desc: "Read 500 ayahs", requirement: 500, check: (s) => s.totalAyahs >= 500 },
  { id: "juz_1", icon: "📗", name: "First Juz", desc: "Complete Juz 1", requirement: 148, check: (s) => s.totalAyahs >= 148 },
  { id: "streak_7", icon: "🔥", name: "On Fire", desc: "7-day streak", requirement: 7, check: (s) => s.streak >= 7 },
  { id: "streak_30", icon: "💎", name: "Devoted", desc: "30-day streak", requirement: 30, check: (s) => s.streak >= 30 },
  { id: "hadith_50", icon: "📜", name: "Muhaddith", desc: "Read 50 ahadith", requirement: 50, check: (s) => s.totalHadith >= 50 },
  { id: "memorize_10", icon: "🧠", name: "Hafiz Start", desc: "Memorize 10 ayaat", requirement: 10, check: (s) => s.memorized >= 10 },
];

const ProgressDashboard = ({ onBack, onNavigate }: ProgressDashboardProps) => {
  const [progress, setProgress] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [hifzCount, setHifzCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Reading progress
      const { data: prog } = await (supabase.from("reading_progress") as any).select("*").eq("user_id", user.id).maybeSingle();
      setProgress(prog || { total_ayahs_read: 0, last_surah_name: "Al-Fatiha", last_ayah_number: 1, hadith_bukhari_read: 0, hadith_muslim_read: 0, hadith_abudawud_read: 0, hadith_tirmizi_read: 0, hadith_nasai_read: 0, hadith_ibnmajah_read: 0 });

      // Activity (last 30 days)
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: act } = await (supabase.from("user_activity") as any).select("*").eq("user_id", user.id).gte("activity_date", thirtyDaysAgo.toISOString().split("T")[0]).order("activity_date", { ascending: true });
      setActivity(act || []);

      // Hifz count
      const { count } = await (supabase.from("hifz_progress") as any).select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("memorized", true);
      setHifzCount(count || 0);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "#25A566", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const totalAyahs = progress?.total_ayahs_read || 0;
  const quranPercent = Math.min(100, Math.round((totalAyahs / TOTAL_QURAN_AYAHS) * 100));
  const hadithBooks = [
    { name: "Bukhari", count: progress?.hadith_bukhari_read || 0, color: "#25A566" },
    { name: "Muslim", count: progress?.hadith_muslim_read || 0, color: "#C9A84C" },
    { name: "Abu Dawood", count: progress?.hadith_abudawud_read || 0, color: "#3b82f6" },
    { name: "Tirmizi", count: progress?.hadith_tirmizi_read || 0, color: "#a855f7" },
    { name: "Nasa'i", count: progress?.hadith_nasai_read || 0, color: "#f97316" },
    { name: "Ibn Majah", count: progress?.hadith_ibnmajah_read || 0, color: "#ec4899" },
  ];
  const totalHadith = hadithBooks.reduce((s, b) => s + b.count, 0);
  const maxHadith = Math.max(1, ...hadithBooks.map(b => b.count));

  // Streak calc
  const actDates = new Set(activity.map(a => a.activity_date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (actDates.has(d.toISOString().split("T")[0])) streak++;
    else break;
  }
  let longestStreak = 0; let curr = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (actDates.has(d.toISOString().split("T")[0])) { curr++; longestStreak = Math.max(longestStreak, curr); }
    else curr = 0;
  }

  // Week reading minutes
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = activity.filter(a => new Date(a.activity_date) >= weekAgo).reduce((s, a) => s + (a.reading_minutes || 0), 0);

  // Heatmap (30 days)
  const heatmapDays: { date: string; level: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const act = activity.find(a => a.activity_date === ds);
    const total = (act?.quran_ayahs_read || 0) + (act?.hadith_read || 0);
    heatmapDays.push({ date: ds, level: total === 0 ? 0 : total < 5 ? 1 : total < 15 ? 2 : total < 30 ? 3 : 4 });
  }

  // Juz progress
  const juzProgress = Array.from({ length: 30 }, (_, i) => {
    const start = JUZ_AYAHS[i]; const end = JUZ_AYAHS[i + 1];
    if (totalAyahs >= end) return "done";
    if (totalAyahs > start) return "progress";
    return "none";
  });

  // Noor Score
  const quranScore = Math.min(400, Math.round((totalAyahs / TOTAL_QURAN_AYAHS) * 400));
  const hadithScore = Math.min(300, Math.round((totalHadith / 200) * 300));
  const consistencyScore = Math.min(300, Math.round((streak / 30) * 300));
  const noorScore = quranScore + hadithScore + consistencyScore;

  const stats = { totalAyahs, totalHadith, streak, memorized: hifzCount };

  // SVG ring
  const ringR = 52; const ringC = 2 * Math.PI * ringR; const ringOffset = ringC - (quranPercent / 100) * ringC;

  return (
    <div className="min-h-screen pb-8">
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Progress</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* === NOOR SCORE === */}
        <div className="text-center p-5 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, rgba(37,165,102,0.12), rgba(201,168,76,0.08))", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>Noor Score</p>
          <p className="font-bold mt-1" style={{ fontSize: 48, color: "#25A566" }}>{noorScore}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>out of 1,000</p>
          <div className="flex justify-center gap-4 mt-3">
            {[
              { label: "Quran", pts: quranScore, max: 400, color: "#25A566" },
              { label: "Hadith", pts: hadithScore, max: 300, color: "#C9A84C" },
              { label: "Streak", pts: consistencyScore, max: 300, color: "#3b82f6" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.pts}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{s.label}/{s.max}</p>
              </div>
            ))}
          </div>
          <p className="mt-3" style={{ fontSize: 11, color: "rgba(201,168,76,0.8)" }}>✨ You are in top 15% of NoorAI users!</p>
        </div>

        {/* === QURAN PROGRESS === */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} style={{ color: "#25A566" }} />
            <span className="font-bold" style={{ fontSize: 14, color: "#F0F4F0" }}>Quran Progress</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Ring */}
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="60" cy="60" r={ringR} fill="none" stroke="#25A566" strokeWidth="8" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringOffset} transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 1s ease" }} />
              <text x="60" y="55" textAnchor="middle" fill="#25A566" fontSize="22" fontWeight="700">{quranPercent}%</text>
              <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">completed</text>
            </svg>
            <div className="flex-1">
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Last read:</p>
              <p className="font-semibold" style={{ fontSize: 14, color: "#F0F4F0" }}>{progress?.last_surah_name} Ayah {progress?.last_ayah_number}</p>
              <p className="mt-1" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{weekMins} min this week</p>
              <button onClick={() => onNavigate("quran")} className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "rgba(37,165,102,0.15)", color: "#25A566", fontSize: 11, fontWeight: 600 }}>
                Continue Reading <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Juz Grid */}
          <p className="mt-3 mb-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Juz Progress</p>
          <div className="flex flex-wrap gap-1">
            {juzProgress.map((s, i) => (
              <div key={i} className="flex items-center justify-center font-bold" style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 9,
                background: s === "done" ? "#25A566" : s === "progress" ? "#f59e0b" : "rgba(255,255,255,0.06)",
                color: s === "none" ? "rgba(255,255,255,0.2)" : "#fff",
              }}>
                {i + 1}
              </div>
            ))}
          </div>

          {hifzCount > 0 && (
            <p className="mt-2" style={{ fontSize: 11, color: "#25A566" }}>🧠 {hifzCount} ayaat memorized</p>
          )}
        </div>

        {/* === HADITH PROGRESS === */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-3">
            <ScrollText size={16} style={{ color: "#C9A84C" }} />
            <span className="font-bold" style={{ fontSize: 14, color: "#F0F4F0" }}>Hadith Progress</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· {totalHadith} total</span>
          </div>

          {hadithBooks.map((b) => (
            <div key={b.name} className="flex items-center gap-2 mb-2">
              <span className="shrink-0" style={{ width: 70, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{b.name}</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (b.count / maxHadith) * 100)}%`, background: b.color }} />
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 30, textAlign: "right" }}>{b.count}</span>
            </div>
          ))}

          <div className="mt-3 p-2.5 rounded-xl flex items-center justify-between" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <span style={{ fontSize: 12, color: "#C9A84C" }}>Today's target: 5 ahadith</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C" }}>{Math.min(5, totalHadith)}/5</span>
          </div>
        </div>

        {/* === STREAK & HEATMAP === */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Flame size={16} style={{ color: "#f59e0b" }} />
            <span className="font-bold" style={{ fontSize: 14, color: "#F0F4F0" }}>Streak</span>
          </div>

          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <p style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{streak}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Current 🔥</p>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{longestStreak}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Longest</p>
            </div>
          </div>

          <p className="mb-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Last 30 Days</p>
          <div className="flex flex-wrap gap-1">
            {heatmapDays.map((d) => {
              const colors = ["rgba(255,255,255,0.05)", "rgba(37,165,102,0.25)", "rgba(37,165,102,0.45)", "rgba(37,165,102,0.7)", "#25A566"];
              return (
                <div key={d.date} className="rounded" style={{ width: 14, height: 14, background: colors[d.level] }} title={d.date} />
              );
            })}
          </div>
        </div>

        {/* === BADGES === */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} style={{ color: "#C9A84C" }} />
            <span className="font-bold" style={{ fontSize: 14, color: "#F0F4F0" }}>Badges</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· {BADGES.filter(b => b.check(stats)).length}/{BADGES.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {BADGES.map((b) => {
              const earned = b.check(stats);
              return (
                <div key={b.id} className="shrink-0 flex flex-col items-center p-3 rounded-xl" style={{ width: 90, background: earned ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${earned ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)"}`, opacity: earned ? 1 : 0.5 }}>
                  <span style={{ fontSize: 28 }}>{earned ? b.icon : "🔒"}</span>
                  <p className="text-center mt-1 font-semibold" style={{ fontSize: 10, color: earned ? "#C9A84C" : "rgba(255,255,255,0.4)" }}>{b.name}</p>
                  <p className="text-center" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressDashboard;
