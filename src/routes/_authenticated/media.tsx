import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music as MusicIcon,
  Loader2,
  Mic2,
  X,
} from "lucide-react";
import { fetchLyrics, fetchTrendingSeeds, searchTracks, type Track } from "@/lib/aria/media-search";
import { useTheme } from "@/components/aria/ThemeProvider";

export const Route = createFileRoute("/_authenticated/media")({
  ssr: false,
  head: () => ({ meta: [{ title: "Media — ARIA" }] }),
  component: MediaPage,
});

type Visual = "bars" | "wave" | "orbital" | "minimal";

function MediaPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);
  const [showLyrics, setShowLyrics] = useState(false);
  const [visual, setVisual] = useState<Visual>("bars");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const { setMood } = useTheme();

  const trending = useQuery({
    queryKey: ["trending-tracks"],
    queryFn: fetchTrendingSeeds,
    staleTime: 5 * 60 * 1000,
  });

  const results = useQuery({
    queryKey: ["track-search", submitted],
    queryFn: () => searchTracks(submitted),
    enabled: !!submitted,
  });

  const lyrics = useQuery({
    queryKey: ["lyrics", current?.artistName, current?.trackName],
    queryFn: () => (current ? fetchLyrics(current.artistName, current.trackName) : Promise.resolve(null)),
    enabled: !!current,
    staleTime: 30 * 60 * 1000,
  });

  const list = submitted ? (results.data ?? []) : (trending.data ?? []);

  function play(track: Track, rest: Track[] = []) {
    setCurrent(track);
    setQueue(rest);
    setShowLyrics(false);
    setProgress(0);
    setMood("speaking");
    navigator.vibrate?.(8);
  }

  function next() {
    if (queue.length === 0) return;
    const [n, ...rest] = queue;
    play(n, rest);
  }

  // Audio element + analyser setup
  useEffect(() => {
    if (!current) return;
    const a = audioRef.current;
    if (!a) return;
    a.src = current.previewUrl;
    a.crossOrigin = "anonymous";
    a.play().catch(() => {});
  }, [current]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 128;
      src.connect(an);
      an.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = an;
    }
    void ctxRef.current?.resume();
  }, [current]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      setMood("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
    } else {
      a.pause();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <MusicIcon className="h-4 w-4 text-accent" />
          <div className="font-display text-xs uppercase tracking-[0.3em] text-primary hud-text-glow">
            Media
          </div>
        </div>
        <div className="flex gap-1">
          {(["bars", "wave", "orbital", "minimal"] as Visual[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisual(v)}
              className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition ${
                visual === v
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-card/60 text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
          className="hud-corner relative mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-card/60 px-3 py-2"
        >
          <Search className="h-4 w-4 text-primary/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search artists, songs, albums…"
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {submitted && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setSubmitted("");
              }}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>

        {(results.isLoading || (trending.isLoading && !submitted)) && (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[11px] uppercase tracking-[0.35em] text-primary/80">
            /// {submitted ? "Results" : "Trending"}
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">{list.length}</span>
        </div>

        <ul className="space-y-2 pb-44">
          {list.map((t, idx) => {
            const isCurrent = current?.id === t.id;
            return (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                onClick={() => play(t, list.slice(idx + 1))}
                className={`hud-corner flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition ${
                  isCurrent
                    ? "border-primary bg-primary/10"
                    : "border-primary/15 bg-card/40 hover:border-primary/40"
                }`}
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                  <img src={t.artworkUrl100} alt="" className="h-full w-full object-cover" />
                  {isCurrent && playing && (
                    <div className="absolute inset-0 grid place-items-center bg-background/60">
                      <Pause className="h-4 w-4 text-accent" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{t.trackName}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.artistName}</div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                  {t.primaryGenreName}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          setProgress(e.currentTarget.currentTime);
          setDuration(e.currentTarget.duration || 30);
        }}
        onPlay={() => {
          setPlaying(true);
          setMood("speaking");
        }}
        onPause={() => {
          setPlaying(false);
          setMood("idle");
        }}
        onEnded={next}
      />

      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="hud-glass fixed inset-x-0 z-30 border-t border-primary/30"
            style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto flex max-w-md flex-col px-3 py-2">
              <Visualizer analyser={analyserRef.current} kind={visual} playing={playing} />
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={current.artworkUrl100}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                  style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.4)" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{current.trackName}</div>
                  <div className="truncate text-xs text-muted-foreground">{current.artistName}</div>
                </div>
                <button
                  onClick={() => setShowLyrics((v) => !v)}
                  className={`grid h-9 w-9 place-items-center rounded-lg border transition ${
                    showLyrics
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-primary/30 bg-card/60 text-primary"
                  }`}
                  aria-label="Lyrics"
                >
                  <Mic2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {fmt(progress)}
                </span>
                <div
                  className="relative h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-primary/15"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current) audioRef.current.currentTime = pct * duration;
                  }}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{
                      width: `${(progress / duration) * 100}%`,
                      boxShadow: "0 0 8px hsl(var(--primary))",
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {fmt(duration)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-center gap-4">
                <button className="text-muted-foreground" aria-label="Previous">
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  onClick={togglePlay}
                  className="grid h-11 w-11 place-items-center rounded-full border border-primary bg-primary/15 text-primary"
                  style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.5)" }}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
                </button>
                <button onClick={next} className="text-muted-foreground" aria-label="Next">
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showLyrics && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 260, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-primary/20 bg-background/95"
                >
                  <LyricsView track={current} lyrics={lyrics.data ?? null} loading={lyrics.isLoading} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function Visualizer({
  analyser,
  kind,
  playing,
}: {
  analyser: AnalyserNode | null;
  kind: Visual;
  playing: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      if (!cvs || !ctx) return;
      const w = cvs.clientWidth;
      const h = cvs.clientHeight;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 64);
    let t = 0;
    function frame() {
      t += 0.04;
      if (!cvs || !ctx) return;
      const w = cvs.clientWidth;
      const h = cvs.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (analyser && playing) analyser.getByteFrequencyData(data);
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const col1 = `hsl(${primary})`;
      const col2 = `hsl(${accent})`;
      if (kind === "bars") {
        const bars = 48;
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * data.length);
          const v = playing ? data[idx] / 255 : (Math.sin(t + i * 0.3) + 1) / 4;
          const bh = v * h * 0.95 + 2;
          ctx.fillStyle = i % 7 === 0 ? col2 : col1;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 8;
          ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      } else if (kind === "wave") {
        ctx.beginPath();
        ctx.strokeStyle = col1;
        ctx.shadowColor = col1;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        for (let i = 0; i < w; i++) {
          const idx = Math.floor((i / w) * data.length);
          const v = playing ? data[idx] / 255 : (Math.sin(t * 2 + i * 0.05) + 1) / 2;
          const y = h / 2 + (v - 0.5) * h * 0.9;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      } else if (kind === "orbital") {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.32;
        const points = 64;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const idx = Math.floor((i / points) * data.length);
          const v = playing ? data[idx] / 255 : 0.4;
          const ang = (i / points) * Math.PI * 2 + t;
          const rr = r + v * 24;
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = col1;
        ctx.shadowColor = col1;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // minimal: simple progress glow line
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, col1);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, h / 2 - 1, w, 2);
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [analyser, kind, playing]);
  return <canvas ref={ref} className="h-12 w-full" />;
}

function LyricsView({
  track,
  lyrics,
  loading,
}: {
  track: Track;
  lyrics: string | null;
  loading: boolean;
}) {
  const lines = useMemo(() => (lyrics ?? "").split("\n").filter((l) => l.trim().length > 0), [lyrics]);
  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }
  if (!lyrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Mic2 className="mb-2 h-5 w-5 text-muted-foreground" />
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          No lyrics found
        </div>
        <div className="mt-1 text-xs text-muted-foreground/70">
          {track.artistName} — {track.trackName}
        </div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-6 py-4 text-center leading-relaxed">
      {lines.map((l, i) => (
        <p key={i} className="text-sm text-foreground/90">
          {l}
        </p>
      ))}
    </div>
  );
}
