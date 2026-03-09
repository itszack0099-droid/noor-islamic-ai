import { loadNotifSettings } from "@/components/NotificationSettings";
import { addNotification } from "@/components/NotificationCenter";

const LAST_SCHEDULED_KEY = "noorai_last_scheduled";
const SAMPLE_AYAHS = [
  { arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", translation: "Verily, with every difficulty comes ease.", ref: "Al-Inshirah 94:6" },
  { arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", translation: "And whoever relies upon Allah – then He is sufficient for him.", ref: "At-Talaq 65:3" },
  { arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ", translation: "So remember Me; I will remember you.", ref: "Al-Baqarah 2:152" },
  { arabic: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ", translation: "And your Lord is going to give you, and you will be satisfied.", ref: "Ad-Duha 93:5" },
  { arabic: "رَبِّ اشْرَحْ لِي صَدْرِي", translation: "My Lord, expand for me my chest.", ref: "Taha 20:25" },
];

const SAMPLE_HADITHS = [
  { text: "The best of you are those who learn the Quran and teach it.", ref: "Bukhari #5027" },
  { text: "Whoever follows a path to seek knowledge, Allah makes easy for him a path to Paradise.", ref: "Muslim #2699" },
  { text: "The strong believer is better and more beloved to Allah than the weak believer.", ref: "Muslim #2664" },
  { text: "Make things easy and do not make them difficult.", ref: "Bukhari #6125" },
  { text: "None of you truly believes until he loves for his brother what he loves for himself.", ref: "Bukhari #13" },
];

function isTimeMatch(settingTime: string): boolean {
  const now = new Date();
  const [h, m] = settingTime.split(":").map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

function isDND(settings: ReturnType<typeof loadNotifSettings>): boolean {
  if (!settings.dndEnabled) return false;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = settings.dndStart.split(":").map(Number);
  const [eh, em] = settings.dndEnd.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins <= endMins;
  }
  return nowMins >= startMins || nowMins <= endMins;
}

function sendBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // Silent fail on mobile browsers
    }
  }
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function checkAndSendNotifications() {
  const settings = loadNotifSettings();
  if (isDND(settings)) return;

  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  const lastKey = localStorage.getItem(LAST_SCHEDULED_KEY);
  if (lastKey === key) return; // Already checked this minute
  localStorage.setItem(LAST_SCHEDULED_KEY, key);

  // Daily Ayah
  if (settings.dailyAyah && isTimeMatch(settings.dailyAyahTime)) {
    const ayah = getRandomItem(SAMPLE_AYAHS);
    const title = "📖 Daily Ayah";
    const body = `${ayah.translation} — ${ayah.ref}`;
    addNotification({ type: "ayah", title, body });
    sendBrowserNotification(title, body);
  }

  // Daily Hadith
  if (settings.dailyHadith && isTimeMatch(settings.dailyHadithTime)) {
    const hadith = getRandomItem(SAMPLE_HADITHS);
    const title = "📜 Daily Hadith";
    const body = `${hadith.text} — ${hadith.ref}`;
    addNotification({ type: "hadith", title, body });
    sendBrowserNotification(title, body);
  }

  // Streak Reminder
  if (settings.streakReminder && isTimeMatch(settings.streakReminderTime)) {
    const streakCount = parseInt(localStorage.getItem("noorai_streak") || "0", 10);
    if (streakCount > 0) {
      const title = "🔥 Don't break your streak!";
      const body = `You're on a ${streakCount} day streak! Keep it going.`;
      addNotification({ type: "streak", title, body });
      sendBrowserNotification(title, body);
    }
  }
}

// Start checking every minute
let intervalId: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler() {
  if (intervalId) return;
  checkAndSendNotifications(); // Check immediately
  intervalId = setInterval(checkAndSendNotifications, 60_000); // Every minute
}

export function stopNotificationScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
