import { useState, useEffect } from "react";
import { ChevronLeft, Bell, BellOff, Clock, Moon, BookOpen, ScrollText, Flame, Volume2 } from "lucide-react";
import { toast } from "sonner";

const SETTINGS_KEY = "noorai_notification_settings";

export interface NotificationSettings {
  dailyAyah: boolean;
  dailyAyahTime: string;
  dailyHadith: boolean;
  dailyHadithTime: string;
  prayerNotifications: boolean;
  prayerMinsBefore: number;
  prayerToggles: Record<string, boolean>;
  streakReminder: boolean;
  streakReminderTime: string;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
}

const defaultSettings: NotificationSettings = {
  dailyAyah: true,
  dailyAyahTime: "07:00",
  dailyHadith: true,
  dailyHadithTime: "12:00",
  prayerNotifications: false,
  prayerMinsBefore: 10,
  prayerToggles: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  streakReminder: true,
  streakReminderTime: "20:00",
  dndEnabled: false,
  dndStart: "22:00",
  dndEnd: "06:00",
};

export function loadNotifSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(s: NotificationSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface Props {
  onBack: () => void;
}

const NotificationSettings = ({ onBack }: Props) => {
  const [settings, setSettings] = useState<NotificationSettings>(loadNotifSettings);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const update = (partial: Partial<NotificationSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveSettings(next);
  };

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }
    const perm = await Notification.requestPermission();
    setPermissionStatus(perm);
    if (perm === "granted") {
      toast.success("Notifications enabled!");
    } else {
      toast.error("Permission denied. Enable in browser settings.");
    }
  };

  const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, hsl(var(--background)), hsl(var(--surface)))", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "hsl(var(--muted))" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Notifications</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Permission Banner */}
        {permissionStatus !== "granted" && (
          <button
            onClick={requestPermission}
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{
              background: "hsl(var(--primary) / 0.1)",
              border: "1px solid hsl(var(--primary) / 0.2)",
            }}
          >
            <Bell size={20} style={{ color: "hsl(var(--primary))" }} />
            <div className="flex-1 text-left">
              <p className="text-foreground font-semibold" style={{ fontSize: 13 }}>Enable Notifications</p>
              <p className="text-muted-foreground" style={{ fontSize: 11 }}>Tap to allow browser notifications</p>
            </div>
          </button>
        )}

        {/* Daily Ayah */}
        <Section title="📖 Daily Ayah" icon={BookOpen}>
          <ToggleRow
            label="Daily Ayah notification"
            enabled={settings.dailyAyah}
            onChange={(v) => update({ dailyAyah: v })}
          />
          {settings.dailyAyah && (
            <TimeRow
              label="Time"
              value={settings.dailyAyahTime}
              onChange={(v) => update({ dailyAyahTime: v })}
            />
          )}
        </Section>

        {/* Daily Hadith */}
        <Section title="📜 Daily Hadith" icon={ScrollText}>
          <ToggleRow
            label="Daily Hadith notification"
            enabled={settings.dailyHadith}
            onChange={(v) => update({ dailyHadith: v })}
          />
          {settings.dailyHadith && (
            <TimeRow
              label="Time"
              value={settings.dailyHadithTime}
              onChange={(v) => update({ dailyHadithTime: v })}
            />
          )}
        </Section>

        {/* Prayer Notifications */}
        <Section title="🕌 Prayer Reminders" icon={Volume2}>
          <ToggleRow
            label="Prayer notifications"
            enabled={settings.prayerNotifications}
            onChange={(v) => update({ prayerNotifications: v })}
          />
          {settings.prayerNotifications && (
            <>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground" style={{ fontSize: 12 }}>Minutes before</span>
                <div className="flex gap-1">
                  {[5, 10, 15].map((m) => (
                    <button
                      key={m}
                      onClick={() => update({ prayerMinsBefore: m })}
                      className="px-3 py-1 rounded-full"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: settings.prayerMinsBefore === m ? "hsl(var(--primary))" : "hsl(var(--muted))",
                        color: settings.prayerMinsBefore === m ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 py-1">
                {prayers.map((p) => (
                  <button
                    key={p}
                    onClick={() => update({ prayerToggles: { ...settings.prayerToggles, [p]: !settings.prayerToggles[p] } })}
                    className="px-3 py-1.5 rounded-full"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: settings.prayerToggles[p] ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))",
                      color: settings.prayerToggles[p] ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      border: `1px solid ${settings.prayerToggles[p] ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Streak Reminder */}
        <Section title="🔥 Streak Reminder" icon={Flame}>
          <ToggleRow
            label="Don't break your streak!"
            enabled={settings.streakReminder}
            onChange={(v) => update({ streakReminder: v })}
          />
          {settings.streakReminder && (
            <TimeRow
              label="Remind at"
              value={settings.streakReminderTime}
              onChange={(v) => update({ streakReminderTime: v })}
            />
          )}
        </Section>

        {/* Do Not Disturb */}
        <Section title="🌙 Do Not Disturb" icon={Moon}>
          <ToggleRow
            label="Quiet hours"
            enabled={settings.dndEnabled}
            onChange={(v) => update({ dndEnabled: v })}
          />
          {settings.dndEnabled && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <span className="text-muted-foreground" style={{ fontSize: 10 }}>From</span>
                <input
                  type="time"
                  value={settings.dndStart}
                  onChange={(e) => update({ dndStart: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg text-foreground outline-none"
                  style={{ fontSize: 13, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
                />
              </div>
              <div className="flex-1">
                <span className="text-muted-foreground" style={{ fontSize: 10 }}>To</span>
                <input
                  type="time"
                  value={settings.dndEnd}
                  onChange={(e) => update({ dndEnd: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg text-foreground outline-none"
                  style={{ fontSize: 13, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
                />
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      <p className="text-foreground font-bold mb-3" style={{ fontSize: 14 }}>{title}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-foreground" style={{ fontSize: 13 }}>{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className="relative rounded-full transition-all"
        style={{
          width: 44,
          height: 24,
          background: enabled ? "hsl(var(--primary))" : "hsl(var(--muted))",
        }}
      >
        <div
          className="absolute top-1 rounded-full transition-all"
          style={{
            width: 16,
            height: 16,
            background: "white",
            left: enabled ? 24 : 4,
          }}
        />
      </button>
    </div>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5" style={{ fontSize: 12 }}>
        <Clock size={12} /> {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1 rounded-lg text-foreground outline-none"
        style={{ fontSize: 12, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
      />
    </div>
  );
}

export default NotificationSettings;
