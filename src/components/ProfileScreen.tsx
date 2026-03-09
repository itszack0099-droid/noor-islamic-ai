import { useState, useEffect } from "react";
import { ChevronLeft, LogOut, User, Settings, Globe, Bell, Type, ChevronRight, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface ProfileScreenProps {
  onBack: () => void;
  onNavigate: (tab: string) => void;
}

const TOTAL_QURAN_AYAHS = 6236;

const BADGES = [
  { id: "first_ayah", icon: "📖", name: "First Step", desc: "Read 1 ayah", check: (s: any) => s.totalAyahs >= 1 },
  { id: "100_ayahs", icon: "🌟", name: "Century", desc: "Read 100 ayahs", check: (s: any) => s.totalAyahs >= 100 },
  { id: "500_ayahs", icon: "🏆", name: "Scholar", desc: "Read 500 ayahs", check: (s: any) => s.totalAyahs >= 500 },
  { id: "juz_1", icon: "📗", name: "First Juz", desc: "Complete Juz 1", check: (s: any) => s.totalAyahs >= 148 },
  { id: "streak_7", icon: "🔥", name: "On Fire", desc: "7-day streak", check: (s: any) => s.streak >= 7 },
  { id: "streak_30", icon: "💎", name: "Devoted", desc: "30-day streak", check: (s: any) => s.streak >= 30 },
  { id: "hadith_50", icon: "📜", name: "Muhaddith", desc: "Read 50 ahadith", check: (s: any) => s.totalHadith >= 50 },
  { id: "memorize_10", icon: "🧠", name: "Hafiz Start", desc: "Memorize 10 ayaat", check: (s: any) => s.memorized >= 10 },
];

const ProfileScreen = ({ onBack, onNavigate }: ProfileScreenProps) => {
  const { t, isRtl } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalAyahs: 0, totalHadith: 0, streak: 0, memorized: 0, noorScore: 0 });
  const [heatmap, setHeatmap] = useState<{ date: string; level: number }[]>([]);
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem("noorai_font_size") || "16"));

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { setLoading(false); return; }
      setUser(u);

      // Reading progress
      const { data: prog } = await (supabase.from("reading_progress") as any).select("*").eq("user_id", u.id).maybeSingle();
      const totalAyahs = prog?.total_ayahs_read || 0;
      const totalHadith = (prog?.hadith_bukhari_read || 0) + (prog?.hadith_muslim_read || 0) +
        (prog?.hadith_abudawud_read || 0) + (prog?.hadith_tirmizi_read || 0) +
        (prog?.hadith_nasai_read || 0) + (prog?.hadith_ibnmajah_read || 0);

      // Activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: activity } = await (supabase.from("user_activity") as any)
        .select("*").eq("user_id", u.id)
        .gte("activity_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("activity_date", { ascending: true });
      const actData = activity || [];

      // Streak
      const actDates = new Set(actData.map((a: any) => a.activity_date));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (actDates.has(d.toISOString().split("T")[0])) streak++;
        else break;
      }

      // Hifz
      const { count: hifzCount } = await (supabase.from("hifz_progress") as any)
        .select("*", { count: "exact", head: true }).eq("user_id", u.id).eq("memorized", true);

      // Noor Score
      const quranScore = Math.min(400, Math.round((totalAyahs / TOTAL_QURAN_AYAHS) * 400));
      const hadithScore = Math.min(300, Math.round((totalHadith / 200) * 300));
      const consistencyScore = Math.min(300, Math.round((streak / 30) * 300));

      setStats({
        totalAyahs,
        totalHadith,
        streak,
        memorized: hifzCount || 0,
        noorScore: quranScore + hadithScore + consistencyScore,
      });

      // Heatmap
      const days: { date: string; level: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        const act = actData.find((a: any) => a.activity_date === ds);
        const total = (act?.quran_ayahs_read || 0) + (act?.hadith_read || 0);
        days.push({ date: ds, level: total === 0 ? 0 : total < 5 ? 1 : total < 15 ? 2 : total < 30 ? 3 : 4 });
      }
      setHeatmap(days);
      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  const handleFontSize = (size: number) => {
    setFontSize(size);
    localStorage.setItem("noorai_font_size", String(size));
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const quranPercent = Math.min(100, Math.round((stats.totalAyahs / TOTAL_QURAN_AYAHS) * 100));
  const earnedBadges = BADGES.filter(b => b.check(stats));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full transition-all active:scale-90" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Profile</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="rounded-full object-cover" style={{ width: 80, height: 80, border: "3px solid hsl(var(--primary))" }} />
            ) : (
              <div className="flex items-center justify-center rounded-full" style={{ width: 80, height: 80, background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dark)))", border: "3px solid hsl(var(--primary))" }}>
                <span className="text-foreground font-bold" style={{ fontSize: 28 }}>{userName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="absolute bottom-0 right-0 flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "hsl(var(--accent))", border: "2px solid hsl(var(--background))" }}>
              <Camera size={14} style={{ color: "hsl(var(--accent-foreground))" }} />
            </div>
          </div>
          <h3 className="text-foreground font-bold" style={{ fontSize: 20 }}>{userName}</h3>
          <p className="text-muted-foreground" style={{ fontSize: 13 }}>{userEmail}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Streak", value: `${stats.streak}🔥`, color: "hsl(var(--primary))" },
            { label: "Quran", value: `${quranPercent}%`, color: "hsl(var(--primary))" },
            { label: "Hadith", value: String(stats.totalHadith), color: "hsl(var(--accent))" },
            { label: "Score", value: String(stats.noorScore), color: "hsl(var(--primary))" },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="font-bold" style={{ fontSize: 16, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-bold text-foreground mb-3" style={{ fontSize: 14 }}>🏆 Badges ({earnedBadges.length}/{BADGES.length})</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {BADGES.map((b) => {
              const earned = b.check(stats);
              return (
                <div key={b.id} className="shrink-0 flex flex-col items-center p-2 rounded-xl transition-all" style={{ width: 72, background: earned ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${earned ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)"}`, opacity: earned ? 1 : 0.4 }}>
                  <span style={{ fontSize: 24 }}>{earned ? b.icon : "🔒"}</span>
                  <p className="text-center mt-1 font-semibold" style={{ fontSize: 9, color: earned ? "hsl(var(--accent))" : "rgba(255,255,255,0.4)" }}>{b.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-bold text-foreground mb-3" style={{ fontSize: 14 }}>📊 Last 30 Days</p>
          <div className="flex flex-wrap gap-1">
            {heatmap.map((d) => {
              const colors = ["rgba(255,255,255,0.05)", "rgba(37,165,102,0.25)", "rgba(37,165,102,0.45)", "rgba(37,165,102,0.7)", "hsl(var(--primary))"];
              return <div key={d.date} className="rounded" style={{ width: 14, height: 14, background: colors[d.level] }} title={d.date} />;
            })}
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Less</span>
            {["rgba(255,255,255,0.05)", "rgba(37,165,102,0.25)", "rgba(37,165,102,0.45)", "rgba(37,165,102,0.7)", "hsl(var(--primary))"].map((c, i) => (
              <div key={i} className="rounded" style={{ width: 10, height: 10, background: c }} />
            ))}
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>More</span>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-bold text-foreground px-4 pt-4 pb-2" style={{ fontSize: 14 }}>⚙️ Settings</p>

          <SettingsRow icon={Globe} label={t("language")} value="" onClick={() => onNavigate("lang-settings")} />
          <SettingsRow icon={Bell} label={t("notifications")} value="" onClick={() => onNavigate("notif-settings")} />

          {/* Font Size */}
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-3 mb-2">
              <Type size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
              <span className="text-foreground" style={{ fontSize: 14 }}>Font Size</span>
              <span className="ml-auto text-muted-foreground" style={{ fontSize: 12 }}>{fontSize}px</span>
            </div>
            <input
              type="range" min={12} max={24} value={fontSize}
              onChange={(e) => handleFontSize(Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold transition-all active:scale-[0.97]"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", fontSize: 14 }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
};

function SettingsRow({ icon: Icon, label, value, onClick }: { icon: any; label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 transition-all active:bg-white/5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <Icon size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
      <span className="flex-1 text-left text-foreground" style={{ fontSize: 14 }}>{label}</span>
      {value && <span className="text-muted-foreground" style={{ fontSize: 12 }}>{value}</span>}
      <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.2)" }} />
    </button>
  );
}

export default ProfileScreen;
