import { useState, useRef, useCallback, useEffect } from "react";
import { X, Download, Share2, Image } from "lucide-react";
import { toast } from "sonner";

interface ShareCardProps {
  open: boolean;
  onClose: () => void;
  arabic: string;
  translation: string;
  reference: string;
  type: "Quran" | "Hadith";
}

type AspectRatio = "1:1" | "9:16" | "16:9";
type ThemeKey = "emerald" | "black" | "navy" | "forest";

const SIZES: { key: AspectRatio; label: string; w: number; h: number }[] = [
  { key: "1:1", label: "Square", w: 1080, h: 1080 },
  { key: "9:16", label: "Story", w: 1080, h: 1920 },
  { key: "16:9", label: "Wide", w: 1920, h: 1080 },
];

const THEMES: { key: ThemeKey; label: string; bg1: string; bg2: string; accent: string }[] = [
  { key: "emerald", label: "Emerald", bg1: "#0A0F0D", bg2: "#1A2820", accent: "#C9A84C" },
  { key: "black", label: "Midnight", bg1: "#0A0A0A", bg2: "#1A1A1A", accent: "#D4AF37" },
  { key: "navy", label: "Navy", bg1: "#0A0E1A", bg2: "#1A2540", accent: "#B8963E" },
  { key: "forest", label: "Forest", bg1: "#061208", bg2: "#0D3318", accent: "#E0C068" },
];

function drawGeometricPattern(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  const size = 60;
  const startX = w - size * 5;
  const startY = 0;

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const cx = startX + col * size;
      const cy = startY + row * size;
      // 8-pointed star pattern
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const r = size * 0.4;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner octagon
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        const r = size * 0.2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapTextRTL(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderCard(
  canvas: HTMLCanvasElement,
  arabic: string,
  translation: string,
  reference: string,
  type: "Quran" | "Hadith",
  size: typeof SIZES[number],
  theme: typeof THEMES[number]
) {
  const { w, h } = size;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(w, h) / 1080;
  const pad = 80 * scale;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Geometric pattern in top-right
  drawGeometricPattern(ctx, w, h, theme.accent);

  // Gold border
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 3 * scale;
  const br = 20 * scale;
  ctx.beginPath();
  ctx.roundRect(pad * 0.4, pad * 0.4, w - pad * 0.8, h - pad * 0.8, br);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Decorative line
  const lineY = h * 0.15;
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, lineY);
  ctx.lineTo(w - pad, lineY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Bismillah ornament for Quran
  if (type === "Quran") {
    ctx.font = `${28 * scale}px Amiri, serif`;
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.25;
    ctx.textAlign = "center";
    ctx.fillText("﷽", w / 2, lineY - 10 * scale);
    ctx.globalAlpha = 1;
  }

  // Arabic text
  const arabicFontSize = Math.min(48 * scale, (w - pad * 2) / (arabic.length / 15 + 1));
  const arabicSize = Math.max(28 * scale, Math.min(52 * scale, arabicFontSize));
  ctx.font = `700 ${arabicSize}px Amiri, serif`;
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.direction = "rtl";

  const maxTextWidth = w - pad * 2.5;
  const arabicLines = wrapTextRTL(ctx, arabic, maxTextWidth);
  const arabicLineHeight = arabicSize * 1.9;
  const totalArabicHeight = arabicLines.length * arabicLineHeight;

  // Center vertically
  const contentStart = (h - totalArabicHeight - 120 * scale) / 2;
  let currentY = contentStart;

  for (const line of arabicLines) {
    ctx.fillText(line, w / 2, currentY + arabicSize);
    currentY += arabicLineHeight;
  }

  // Separator
  currentY += 20 * scale;
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const sepW = 120 * scale;
  ctx.moveTo(w / 2 - sepW / 2, currentY);
  ctx.lineTo(w / 2 + sepW / 2, currentY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  currentY += 30 * scale;

  // Translation
  const transFontSize = 22 * scale;
  ctx.font = `400 ${transFontSize}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.direction = "ltr";

  const transLines = wrapText(ctx, translation, maxTextWidth, transFontSize * 1.6);
  for (const line of transLines) {
    ctx.fillText(line, w / 2, currentY + transFontSize);
    currentY += transFontSize * 1.6;
  }

  // Reference (bottom left)
  const bottomY = h - pad * 0.8;
  ctx.font = `500 ${16 * scale}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "left";
  ctx.fillText(reference, pad, bottomY);

  // Type badge
  const badgeColor = type === "Quran" ? "#25A566" : theme.accent;
  ctx.fillStyle = badgeColor;
  ctx.globalAlpha = 0.2;
  const badgeX = pad;
  const badgeY = bottomY - 35 * scale;
  const badgeW = ctx.measureText(type).width + 20 * scale;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, 22 * scale, 6 * scale);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = badgeColor;
  ctx.font = `600 ${12 * scale}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(type, badgeX + 10 * scale, badgeY + 16 * scale);

  // NoorAI watermark (bottom right)
  ctx.font = `700 ${18 * scale}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.textAlign = "right";
  ctx.fillText("NoorAI ✦", w - pad, bottomY);
}

const ShareCardSheet = ({ open, onClose, arabic, translation, reference, type }: ShareCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [theme, setTheme] = useState<ThemeKey>("emerald");

  const selectedSize = SIZES.find((s) => s.key === ratio)!;
  const selectedTheme = THEMES.find((t) => t.key === theme)!;

  const render = useCallback(() => {
    if (!canvasRef.current) return;
    renderCard(canvasRef.current, arabic, translation, reference, type, selectedSize, selectedTheme);
  }, [arabic, translation, reference, type, selectedSize, selectedTheme]);

  useEffect(() => {
    if (open) render();
  }, [open, render]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `noorai-${type.toLowerCase()}-${ratio.replace(":", "x")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    toast.success("Image saved!");
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve) =>
        canvasRef.current!.toBlob((b) => resolve(b!), "image/png")
      );
      const file = new File([blob], `noorai-${type.toLowerCase()}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${type} - NoorAI` });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  if (!open) return null;

  const previewW = 320;
  const previewH = (selectedSize.h / selectedSize.w) * previewW;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />

      <div
        className="relative w-full animate-slide-up"
        style={{ maxWidth: 393, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-t-3xl overflow-hidden"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderBottom: "none" }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "hsl(var(--muted-foreground) / 0.3)" }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <Image size={18} style={{ color: "hsl(var(--accent))" }} />
              <p className="font-bold text-foreground" style={{ fontSize: 16 }}>Share as Card</p>
            </div>
            <button onClick={onClose} className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: "hsl(var(--muted))" }}>
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 pb-5 overflow-y-auto" style={{ maxHeight: "75vh" }}>
            {/* Preview */}
            <div className="flex justify-center mb-4">
              <div style={{ width: previewW, height: Math.min(previewH, 400), overflow: "hidden", borderRadius: 12, border: "1px solid hsl(var(--border))" }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: previewW, height: previewH, objectFit: "contain" }}
                />
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="mb-3">
              <p className="text-muted-foreground mb-2" style={{ fontSize: 11 }}>Size</p>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setRatio(s.key)}
                    className="flex-1 py-2 rounded-xl font-semibold"
                    style={{
                      fontSize: 12,
                      background: ratio === s.key ? "hsl(var(--accent) / 0.15)" : "hsl(var(--muted))",
                      color: ratio === s.key ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
                      border: `1px solid ${ratio === s.key ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"}`,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="mb-4">
              <p className="text-muted-foreground mb-2" style={{ fontSize: 11 }}>Theme</p>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className="flex-1 py-2 rounded-xl font-semibold"
                    style={{
                      fontSize: 11,
                      background: theme === t.key ? t.bg2 : "hsl(var(--muted))",
                      color: theme === t.key ? t.accent : "hsl(var(--muted-foreground))",
                      border: `1px solid ${theme === t.key ? t.accent + "4D" : "hsl(var(--border))"}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                style={{
                  fontSize: 13,
                  background: "hsl(var(--muted))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Download size={16} /> Download
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                style={{
                  fontSize: 13,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareCardSheet;
