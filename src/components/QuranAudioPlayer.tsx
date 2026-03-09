import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Download, Timer, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  translation: string;
}

interface QuranAudioPlayerProps {
  ayahs: Ayah[];
  surahName: string;
  surahNumber: number;
  playingAyahIdx: number | null;
  onPlayAyah: (idx: number | null) => void;
}

const QARIS = [
  { key: "ar.alafasy", label: "Mishary Rashid" },
  { key: "ar.abdurrahmaansudais", label: "Sudais" },
  { key: "ar.abdullahbasfar", label: "Basfar" },
  { key: "ar.mahermuaiqly", label: "Maher Al-Muaiqly" },
  { key: "ar.minshawi", label: "Minshawi" },
];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const SLEEP_OPTIONS = [
  { label: "Off", mins: 0 },
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
  { label: "1hr", mins: 60 },
];

function getAudioUrl(qari: string, ayahNumber: number) {
  return `https://cdn.islamic.network/quran/audio/128/${qari}/${ayahNumber}.mp3`;
}

const AUDIO_CACHE_PREFIX = "quran_audio_";

async function getCachedAudio(url: string): Promise<string> {
  const cacheKey = AUDIO_CACHE_PREFIX + btoa(url).slice(0, 40);
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  return url; // fallback to streaming
}

async function cacheAudioBlob(url: string): Promise<void> {
  try {
    const cacheKey = AUDIO_CACHE_PREFIX + btoa(url).slice(0, 40);
    if (localStorage.getItem(cacheKey)) return;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => {
        try {
          localStorage.setItem(cacheKey, reader.result as string);
        } catch {
          // localStorage full
        }
        resolve();
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    // ignore
  }
}

const QuranAudioPlayer = ({ ayahs, surahName, surahNumber, playingAyahIdx, onPlayAyah }: QuranAudioPlayerProps) => {
  const [qari, setQari] = useState("ar.alafasy");
  const [speed, setSpeed] = useState(1);
  const [continuous, setContinuous] = useState(true);
  const [sleepMins, setSleepMins] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentAyah = playingAyahIdx !== null ? ayahs[playingAyahIdx] : null;

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Handle ayah change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playingAyahIdx === null || !currentAyah) {
      if (audio) { audio.pause(); setIsPlaying(false); }
      return;
    }

    const play = async () => {
      const url = getAudioUrl(qari, currentAyah.number);
      const src = await getCachedAudio(url);
      audio.src = src;
      audio.playbackRate = speed;
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    play();
  }, [playingAyahIdx, qari, currentAyah]);

  // Handle auto-next on end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      if (continuous && playingAyahIdx !== null && playingAyahIdx < ayahs.length - 1) {
        onPlayAyah(playingAyahIdx + 1);
      } else {
        onPlayAyah(null);
      }
    };

    audio.removeEventListener("ended", handleEnded);
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [continuous, playingAyahIdx, ayahs.length, onPlayAyah]);

  // Speed change
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Sleep timer
  useEffect(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepMins > 0 && isPlaying) {
      sleepTimerRef.current = setTimeout(() => {
        audioRef.current?.pause();
        setIsPlaying(false);
        onPlayAyah(null);
        toast.info("Sleep timer ended. Good night! 🌙");
      }, sleepMins * 60 * 1000);
    }
    return () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); };
  }, [sleepMins, isPlaying, onPlayAyah]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (playingAyahIdx === null && ayahs.length > 0) {
        onPlayAyah(0);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const prevAyah = () => {
    if (playingAyahIdx !== null && playingAyahIdx > 0) onPlayAyah(playingAyahIdx - 1);
  };

  const nextAyah = () => {
    if (playingAyahIdx !== null && playingAyahIdx < ayahs.length - 1) onPlayAyah(playingAyahIdx + 1);
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const handleDownloadSurah = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    let done = 0;
    for (const ayah of ayahs) {
      const url = getAudioUrl(qari, ayah.number);
      await cacheAudioBlob(url);
      done++;
      setDownloadProgress(Math.round((done / ayahs.length) * 100));
    }
    setDownloading(false);
    toast.success(`Downloaded ${surahName} (${ayahs.length} ayaat) for offline!`);
  };

  if (playingAyahIdx === null && !showControls) return null;

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-40"
      style={{ width: "100%", maxWidth: 393 }}
    >
      <div
        className="mx-3 rounded-2xl overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Mini bar */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={togglePlay} className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: "hsl(var(--primary))" }}>
            {isPlaying ? <Pause size={16} className="text-primary-foreground" /> : <Play size={16} className="text-primary-foreground ml-0.5" />}
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-foreground font-semibold truncate" style={{ fontSize: 12 }}>
              {currentAyah ? `Ayah ${currentAyah.numberInSurah}` : surahName}
            </p>
            <p className="text-muted-foreground truncate" style={{ fontSize: 10 }}>
              {QARIS.find((q) => q.key === qari)?.label} · {speed}x
              {continuous && " · Auto"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={prevAyah} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
              <SkipBack size={14} className="text-foreground" />
            </button>
            <button onClick={nextAyah} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
              <SkipForward size={14} className="text-foreground" />
            </button>
            <button onClick={() => setShowControls(!showControls)} className="p-1.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
              <ChevronDown size={14} className={`text-foreground transition-transform ${showControls ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground" style={{ fontSize: 9 }}>{formatTime(progress)}</span>
            <div
              className="flex-1 h-1.5 rounded-full cursor-pointer"
              style={{ background: "hsl(var(--muted))" }}
              onClick={seekTo}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${duration ? (progress / duration) * 100 : 0}%`,
                  background: "hsl(var(--primary))",
                }}
              />
            </div>
            <span className="text-muted-foreground" style={{ fontSize: 9 }}>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Expanded controls */}
        {showControls && (
          <div className="px-4 pb-3 flex flex-col gap-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            {/* Speed */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>Speed</span>
              <div className="flex gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className="px-2.5 py-1 rounded-full"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: speed === s ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: speed === s ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Qari */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>Qari</span>
              <select
                value={qari}
                onChange={(e) => setQari(e.target.value)}
                className="rounded-lg px-2 py-1 text-foreground outline-none"
                style={{
                  fontSize: 11,
                  background: "hsl(var(--muted))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {QARIS.map((q) => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </select>
            </div>

            {/* Continuous + Sleep */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground" style={{ fontSize: 11 }}>Auto-play</span>
                <button
                  onClick={() => setContinuous(!continuous)}
                  className="rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: continuous ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))",
                    color: continuous ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {continuous ? "ON" : "OFF"}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Timer size={12} className="text-muted-foreground" />
                {SLEEP_OPTIONS.map((opt) => (
                  <button
                    key={opt.mins}
                    onClick={() => setSleepMins(opt.mins)}
                    className="px-2 py-1 rounded-full"
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      background: sleepMins === opt.mins ? "hsl(var(--accent) / 0.15)" : "hsl(var(--muted))",
                      color: sleepMins === opt.mins ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownloadSurah}
              disabled={downloading}
              className="flex items-center justify-center gap-2 py-2 rounded-xl font-semibold"
              style={{
                fontSize: 12,
                background: "hsl(var(--muted))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              {downloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Downloading… {downloadProgress}%
                </>
              ) : (
                <>
                  <Download size={14} />
                  Download {surahName} for Offline
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuranAudioPlayer;
export { QARIS, getAudioUrl };
