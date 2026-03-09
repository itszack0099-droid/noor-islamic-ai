import { ChevronLeft, Check, Globe } from "lucide-react";
import { useI18n, LANGUAGES, LangCode } from "@/lib/i18n";

interface Props {
  onBack: () => void;
}

const LanguageSettings = ({ onBack }: Props) => {
  const { lang, secondaryLang, setLang, setSecondaryLang, t, isRtl } = useI18n();

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div style={{ background: "linear-gradient(160deg, hsl(var(--background)), hsl(var(--surface)))", paddingTop: 12 }}>
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "hsl(var(--muted))" }}>
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>{t("language")}</h2>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* App Language */}
        <div className="rounded-2xl p-4" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={16} style={{ color: "hsl(var(--primary))" }} />
            <p className="text-foreground font-bold" style={{ fontSize: 14 }}>{t("appLanguage")}</p>
          </div>
          <div className="flex flex-col gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className="flex items-center justify-between px-3 py-3 rounded-xl transition-all"
                style={{
                  background: lang === l.code ? "hsl(var(--primary) / 0.1)" : "transparent",
                  border: lang === l.code ? "1px solid hsl(var(--primary) / 0.2)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>{l.flag}</span>
                  <span className="text-foreground font-medium" style={{ fontSize: 14 }}>{l.label}</span>
                </div>
                {lang === l.code && <Check size={18} style={{ color: "hsl(var(--primary))" }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Translation */}
        <div className="rounded-2xl p-4" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-foreground font-bold" style={{ fontSize: 14 }}>{t("secondaryLanguage")}</p>
          </div>
          <p className="text-muted-foreground mb-3" style={{ fontSize: 11 }}>
            Show two translations simultaneously in Quran view
          </p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setSecondaryLang(null)}
              className="flex items-center justify-between px-3 py-3 rounded-xl transition-all"
              style={{
                background: !secondaryLang ? "hsl(var(--accent) / 0.1)" : "transparent",
                border: !secondaryLang ? "1px solid hsl(var(--accent) / 0.2)" : "1px solid transparent",
              }}
            >
              <span className="text-foreground font-medium" style={{ fontSize: 14 }}>{t("none")}</span>
              {!secondaryLang && <Check size={18} style={{ color: "hsl(var(--accent))" }} />}
            </button>
            {LANGUAGES.filter(l => l.code !== lang).map((l) => (
              <button
                key={l.code}
                onClick={() => setSecondaryLang(l.code)}
                className="flex items-center justify-between px-3 py-3 rounded-xl transition-all"
                style={{
                  background: secondaryLang === l.code ? "hsl(var(--accent) / 0.1)" : "transparent",
                  border: secondaryLang === l.code ? "1px solid hsl(var(--accent) / 0.2)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>{l.flag}</span>
                  <span className="text-foreground font-medium" style={{ fontSize: 14 }}>{l.label}</span>
                </div>
                {secondaryLang === l.code && <Check size={18} style={{ color: "hsl(var(--accent))" }} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSettings;
