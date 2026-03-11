import { useState, useEffect } from "react";
import { ChevronLeft, BookOpen, Brain, Mic, Bell, Palette, User, Info, LogOut, ChevronRight, Mail } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface SettingsScreenProps {
  onBack: () => void;
  onNavigate: (tab: string) => void;
}

const RECITERS = [
  "Abdul Basit", "Mishary Alafasy", "Abdul Rahman Al-Sudais", "Saud Al-Shuraim",
  "Maher Al Muaiqly", "Saad Al-Ghamdi", "Ahmed Al Ajmi", "Hani Ar-Rifai",
  "Yasser Ad-Dossari", "Abu Bakr Al-Shatri", "Nasser Al Qatami", "Muhammad Ayyub",
];

const TRANSLATION_LANGS = [
  { id: "en", label: "English" },
  { id: "ur", label: "Urdu" },
  { id: "hi", label: "Hindi" },
  { id: "fr", label: "French" },
  { id: "ar", label: "Arabic (Tafsir)" },
];

const APP_LANGS = [
  { id: "en", label: "English" },
  { id: "ur", label: "اردو" },
  { id: "hi", label: "हिन्दी" },
  { id: "ar", label: "العربية" },
];

const FONTS = ["Amiri", "Noto Naskh Arabic", "Scheherazade New"];

const SettingsScreen = ({ onBack, onNavigate }: SettingsScreenProps) => {
  const { currentLanguage, setLang } = useI18n();

  // Quran settings
  const [arabicSize, setArabicSize] = useState(() => Number(localStorage.getItem("quran_arabic_size") || "26"));
  const [transLang, setTransLang] = useState(() => localStorage.getItem("quran_trans_lang") || "en");
  const [showTrans, setShowTrans] = useState(() => localStorage.getItem("quran_show_trans") !== "false");
  const [reciter, setReciter] = useState(() => localStorage.getItem("quran_reciter") || "Mishary Alafasy");
  const [tajweed, setTajweed] = useState(() => localStorage.getItem("quran_tajweed") !== "false");

  // Hifz settings
  const [vibrate, setVibrate] = useState(() => localStorage.getItem("hifz_vibrate") !== "false");
  const [autoPause, setAutoPause] = useState(() => localStorage.getItem("hifz_autopause") !== "false");
  const [sensitivity, setSensitivity] = useState(() => localStorage.getItem("hifz_sensitivity") || "normal");

  // Notifications
  const [prayerAlerts, setPrayerAlerts] = useState(() => localStorage.getItem("notif_prayer") === "true");
  const [quranReminder, setQuranReminder] = useState(() => localStorage.getItem("notif_quran") === "true");
  const [streakReminder, setStreakReminder] = useState(() => localStorage.getItem("notif_streak") === "true");

  // Appearance
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem("arabic_font") || "Amiri");

  const save = (key: string, val: string) => localStorage.setItem(key, val);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className="w-10 h-6 rounded-full transition-all" style={{ background: value ? "#25A566" : "rgba(255,255,255,0.15)" }}>
      <div className="w-4 h-4 rounded-full bg-white transition-all" style={{ marginLeft: value ? 20 : 4, marginTop: 4 }} />
    </button>
  );

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3 px-1">
        {icon}
        <span className="uppercase font-semibold" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{title}</span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ label, right }: { label: string; right: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      {right}
    </div>
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
  };

  return (
    <div className="min-h-screen" style={{ background: "#0A0F0D" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onBack} className="p-2 rounded-full active:scale-90 transition-transform" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Settings</h2>
      </div>

      <div className="px-4 py-4 pb-20">
        {/* QURAN */}
        <Section icon={<BookOpen size={14} style={{ color: "#25A566" }} />} title="Quran Settings">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Arabic Font Size: {arabicSize}px</p>
            <Slider value={[arabicSize]} min={16} max={36} step={1} onValueChange={([v]) => { setArabicSize(v); save("quran_arabic_size", String(v)); }} />
          </div>
          <Row label="Translation Language" right={
            <select value={transLang} onChange={e => { setTransLang(e.target.value); save("quran_trans_lang", e.target.value); }} className="bg-transparent text-right outline-none" style={{ fontSize: 13, color: "#25A566" }}>
              {TRANSLATION_LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          } />
          <Row label="Show Translation" right={<Toggle value={showTrans} onChange={v => { setShowTrans(v); save("quran_show_trans", String(v)); }} />} />
          <Row label="Reciter" right={
            <select value={reciter} onChange={e => { setReciter(e.target.value); save("quran_reciter", e.target.value); }} className="bg-transparent text-right outline-none max-w-[140px]" style={{ fontSize: 12, color: "#25A566" }}>
              {RECITERS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          } />
          <Row label="Tajweed Colors" right={<Toggle value={tajweed} onChange={v => { setTajweed(v); save("quran_tajweed", String(v)); }} />} />
        </Section>

        {/* HIFZ */}
        <Section icon={<Brain size={14} style={{ color: "#A78BFA" }} />} title="Hifz Settings">
          <Row label="Vibrate on Mistake" right={<Toggle value={vibrate} onChange={v => { setVibrate(v); save("hifz_vibrate", String(v)); }} />} />
          <Row label="Auto-pause on Mistake" right={<Toggle value={autoPause} onChange={v => { setAutoPause(v); save("hifz_autopause", String(v)); }} />} />
          <Row label="Sensitivity" right={
            <div className="flex gap-1">
              {["strict", "normal", "lenient"].map(s => (
                <button key={s} onClick={() => { setSensitivity(s); save("hifz_sensitivity", s); }} className="px-2.5 py-1 rounded-lg capitalize" style={{ fontSize: 11, background: sensitivity === s ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.05)", color: sensitivity === s ? "#A78BFA" : "rgba(255,255,255,0.4)" }}>
                  {s}
                </button>
              ))}
            </div>
          } />
        </Section>

        {/* NOTIFICATIONS */}
        <Section icon={<Bell size={14} style={{ color: "#FCD34D" }} />} title="Notifications">
          <Row label="Prayer Time Alerts" right={<Toggle value={prayerAlerts} onChange={v => { setPrayerAlerts(v); save("notif_prayer", String(v)); toast.success(v ? "Prayer alerts enabled" : "Prayer alerts disabled"); }} />} />
          <Row label="Daily Quran Reminder" right={<Toggle value={quranReminder} onChange={v => { setQuranReminder(v); save("notif_quran", String(v)); }} />} />
          <Row label="Streak Reminder" right={<Toggle value={streakReminder} onChange={v => { setStreakReminder(v); save("notif_streak", String(v)); }} />} />
        </Section>

        {/* APPEARANCE */}
        <Section icon={<Palette size={14} style={{ color: "#C9A84C" }} />} title="Appearance">
          <Row label="App Language" right={
            <select value={currentLanguage} onChange={e => setLanguage(e.target.value)} className="bg-transparent text-right outline-none" style={{ fontSize: 13, color: "#C9A84C" }}>
              {APP_LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          } />
          <Row label="Arabic Font" right={
            <select value={fontFamily} onChange={e => { setFontFamily(e.target.value); save("arabic_font", e.target.value); }} className="bg-transparent text-right outline-none" style={{ fontSize: 12, color: "#C9A84C" }}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          } />
        </Section>

        {/* ACCOUNT */}
        <Section icon={<User size={14} style={{ color: "#60A5FA" }} />} title="Account">
          <button onClick={() => onNavigate("profile")} className="w-full flex items-center justify-between px-4 py-3 active:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Edit Profile</span>
            <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.2)" }} />
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-between px-4 py-3 active:bg-white/5 transition-colors">
            <span style={{ fontSize: 13, color: "#F87171" }}>Logout</span>
            <LogOut size={16} style={{ color: "#F87171" }} />
          </button>
        </Section>

        {/* ABOUT */}
        <Section icon={<Info size={14} style={{ color: "rgba(255,255,255,0.4)" }} />} title="About">
          <div className="px-4 py-4 text-center">
            <p style={{ fontSize: 18, fontWeight: 800, color: "#C9A84C" }}>NoorAI</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Version 1.0.0</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Made with ❤️ for Muslims</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <Mail size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>syedfurqan0099@gmail.com</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default SettingsScreen;
