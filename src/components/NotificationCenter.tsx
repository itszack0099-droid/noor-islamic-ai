import { useState, useEffect } from "react";
import { X, BookOpen, ScrollText, Flame, Bell, Trash2 } from "lucide-react";

export interface NotifItem {
  id: string;
  type: "ayah" | "hadith" | "streak" | "prayer" | "general";
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

const NOTIF_KEY = "noorai_notifications";

export function getNotifications(): NotifItem[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addNotification(notif: Omit<NotifItem, "id" | "timestamp" | "read">) {
  const items = getNotifications();
  const newItem: NotifItem = {
    ...notif,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    read: false,
  };
  items.unshift(newItem);
  // Keep last 10
  localStorage.setItem(NOTIF_KEY, JSON.stringify(items.slice(0, 10)));
  return newItem;
}

export function markAllRead() {
  const items = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(NOTIF_KEY, JSON.stringify(items));
}

export function clearNotifications() {
  localStorage.setItem(NOTIF_KEY, "[]");
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const iconMap = {
  ayah: BookOpen,
  hadith: ScrollText,
  streak: Flame,
  prayer: Bell,
  general: Bell,
};

const colorMap = {
  ayah: "hsl(var(--primary))",
  hadith: "hsl(var(--accent))",
  streak: "#f59e0b",
  prayer: "hsl(var(--primary))",
  general: "hsl(var(--muted-foreground))",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const NotificationCenter = ({ open, onClose }: Props) => {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  useEffect(() => {
    if (open) {
      setNotifs(getNotifications());
      // Mark all as read after a short delay
      setTimeout(() => markAllRead(), 500);
    }
  }, [open]);

  const handleClear = () => {
    clearNotifications();
    setNotifs([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />

      <div
        className="relative w-full mx-4 animate-slide-up rounded-2xl overflow-hidden"
        style={{ maxWidth: 370, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: "hsl(var(--primary))" }} />
            <p className="text-foreground font-bold" style={{ fontSize: 15 }}>Notifications</p>
          </div>
          <div className="flex items-center gap-2">
            {notifs.length > 0 && (
              <button onClick={handleClear} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                <Trash2 size={14} className="text-muted-foreground" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-none">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Bell size={28} className="text-muted-foreground" style={{ opacity: 0.3 }} />
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>No notifications yet</p>
            </div>
          ) : (
            notifs.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              const color = colorMap[n.type] || "hsl(var(--muted-foreground))";
              return (
                <div
                  key={n.id}
                  className="flex gap-3 px-4 py-3"
                  style={{
                    borderBottom: "1px solid hsl(var(--border))",
                    background: n.read ? "transparent" : "hsl(var(--primary) / 0.03)",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                    style={{ width: 32, height: 32, background: `${color}20` }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-foreground font-semibold truncate" style={{ fontSize: 12 }}>{n.title}</p>
                      <span className="text-muted-foreground shrink-0" style={{ fontSize: 10 }}>{timeAgo(n.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: 11, lineHeight: 1.4 }}>{n.body}</p>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background: "hsl(var(--primary))" }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
