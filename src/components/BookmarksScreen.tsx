import { useState, useEffect } from "react";
import { ChevronLeft, Bookmark, Trash2, BookOpen, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

interface BookmarkItem {
  id: string;
  type: string;
  arabic: string;
  translation: string;
  reference: string;
  created_at: string;
}

interface Props {
  onBack: () => void;
}

const BookmarksScreen = ({ onBack }: Props) => {
  const { t, isRtl } = useI18n();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "quran" | "hadith">("all");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await (supabase.from("bookmarks") as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setBookmarks(data || []);
      setLoading(false);
    })();
  }, []);

  const removeBookmark = async (id: string) => {
    await (supabase.from("bookmarks") as any).delete().eq("id", id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const filtered = filter === "all" ? bookmarks : bookmarks.filter(b => b.type === filter);

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div style={{ background: "linear-gradient(160deg, #050F08, #0D4D2E)", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("bookmarks")}</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-5 py-3">
        {(["all", "quran", "hadith"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-full font-semibold transition-all"
            style={{
              fontSize: 12,
              background: filter === f ? "#25A566" : "rgba(255,255,255,0.07)",
              color: filter === f ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {f === "all" ? t("allBooks").split(" ")[0] : f === "quran" ? t("quran") : t("hadith")}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-3 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bookmark size={40} style={{ color: "rgba(255,255,255,0.15)" }} />
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{t("noBookmarks")}</p>
          </div>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
              <div className="flex items-center justify-between px-4 pt-4">
                <div className="flex items-center gap-2">
                  {b.type === "quran" ? <BookOpen size={14} style={{ color: "#25A566" }} /> : <ScrollText size={14} style={{ color: "#C9A84C" }} />}
                  <span className="font-semibold uppercase" style={{ fontSize: 11, color: b.type === "quran" ? "#25A566" : "#C9A84C", letterSpacing: 1 }}>
                    {b.reference}
                  </span>
                </div>
                <button onClick={() => removeBookmark(b.id)} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "rgba(239,68,68,0.12)" }}>
                  <Trash2 size={14} style={{ color: "#ef4444" }} />
                </button>
              </div>
              {b.arabic && (
                <p className="font-arabic text-right px-4 mt-2" dir="rtl" style={{ fontSize: 18, color: "#F0D080", lineHeight: 1.8 }}>
                  {b.arabic}
                </p>
              )}
              <p className="px-4 py-3" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                {b.translation}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookmarksScreen;

// Helper to add bookmark from other screens
export async function addBookmark(type: "quran" | "hadith", arabic: string, translation: string, reference: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await (supabase.from("bookmarks") as any).insert({
    user_id: user.id,
    type,
    arabic,
    translation,
    reference,
  });
  return !error;
}

export async function removeBookmarkByRef(reference: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await (supabase.from("bookmarks") as any).delete().eq("user_id", user.id).eq("reference", reference);
  return !error;
}

export async function isBookmarked(reference: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await (supabase.from("bookmarks") as any).select("id").eq("user_id", user.id).eq("reference", reference).maybeSingle();
  return !!data;
}
