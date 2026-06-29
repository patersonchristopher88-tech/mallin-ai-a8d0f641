import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNowPlaying, spotifyControl } from "@/lib/aria/spotify.functions";
import { Play, Pause, SkipForward, SkipBack, Music2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

export function SpotifyHud() {
  const nowFn = useServerFn(getNowPlaying);
  const controlFn = useServerFn(spotifyControl);
  const [busy, setBusy] = useState(false);

  const np = useQuery({
    queryKey: ["spotify-now"],
    queryFn: () => nowFn(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Local progress tween between polls
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!np.data || !("progress_ms" in np.data) || !np.data.playing) return;
    setProgress(np.data.progress_ms ?? 0);
    const start = Date.now();
    const base = np.data.progress_ms ?? 0;
    const dur = np.data.duration_ms ?? 1;
    const id = setInterval(() => {
      setProgress(Math.min(dur, base + (Date.now() - start)));
    }, 250);
    return () => clearInterval(id);
  }, [np.data]);

  if (!np.data || !("track" in np.data) || !np.data.track) return null;

  const d = np.data;
  const dur = d.duration_ms ?? 1;
  const pct = Math.max(0, Math.min(100, (progress / dur) * 100));

  async function ctl(action: "play" | "pause" | "next" | "previous") {
    setBusy(true);
    try {
      await controlFn({ data: { action } });
      await np.refetch();
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="hud-corner mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-lg border border-accent/30 bg-card/70 px-3 py-2 backdrop-blur"
      >
        {d.cover ? (
          <img src={d.cover} alt="" className="h-10 w-10 rounded object-cover ring-1 ring-accent/30" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded bg-accent/15 text-accent">
            <Music2 className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[11px] uppercase tracking-widest text-accent">
            {d.track}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{d.artist}</div>
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-accent/15">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn onClick={() => ctl("previous")} disabled={busy} aria="prev">
            <SkipBack className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={() => ctl(d.playing ? "pause" : "play")}
            disabled={busy}
            aria="play/pause"
          >
            {d.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn onClick={() => ctl("next")} disabled={busy} aria="next">
            <SkipForward className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function IconBtn({
  onClick,
  disabled,
  aria,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="grid h-7 w-7 place-items-center rounded border border-accent/30 bg-background/60 text-accent transition hover:bg-accent/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
