import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Eye,
  Scan,
  Infinity as InfinityIcon,
  Hand,
} from "lucide-react";
import { useLiveVision } from "@/lib/aria/useLiveVision";

export const Route = createFileRoute("/_authenticated/vision")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live Vision — ARIA" }] }),
  component: VisionPage,
});

function VisionPage() {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [speak, setSpeak] = useState(true);
  const [askInput, setAskInput] = useState("");
  const [mode, setMode] = useState<"manual" | "continuous">("manual");
  const {
    videoRef,
    active,
    start,
    stop,
    analyzeOnce,
    samples,
    thinking,
    lastError,
  } = useLiveVision({
    facingMode,
    intervalMs: mode === "continuous" ? 3500 : 0,
    brief: true,
    speak,
  });

  function swapCamera() {
    stop();
    setFacingMode((f) => (f === "user" ? "environment" : "user"));
    setTimeout(() => start(), 250);
  }

  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <Link to="/chat" className="flex items-center gap-2 text-primary/80">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-xs uppercase tracking-[0.3em]">Vision</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-primary/30 bg-card/60 p-0.5">
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                mode === "manual" ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
              aria-pressed={mode === "manual"}
            >
              <Hand className="h-3 w-3" /> Manual
            </button>
            <button
              onClick={() => setMode("continuous")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                mode === "continuous" ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
              aria-pressed={mode === "continuous"}
            >
              <InfinityIcon className="h-3 w-3" /> Live
            </button>
          </div>
          <button
            onClick={() => setSpeak((s) => !s)}
            aria-label="Toggle voice"
            className={`grid h-9 w-9 place-items-center rounded-full border transition ${
              speak ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={swapCamera}
            disabled={!active}
            aria-label="Flip camera"
            className="grid h-9 w-9 place-items-center rounded-full border border-primary/50 bg-primary/10 text-primary transition disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
          muted
          playsInline
        />

        {/* HUD overlay */}
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-primary" />
          <span className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-primary" />
          <span className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-primary" />
          <span className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-primary" />
          {active && mode === "continuous" && (
            <motion.div
              className="absolute inset-x-0 h-[2px] bg-primary/70"
              style={{ boxShadow: "0 0 12px hsl(var(--primary))" }}
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}
            />
          )}
          {active && thinking && (
            <motion.div
              className="absolute inset-x-0 h-[2px] bg-accent"
              style={{ boxShadow: "0 0 12px hsl(var(--accent))" }}
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          )}
          <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </div>

        {!active && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur">
            <div className="hud-corner hud-glass max-w-xs rounded-2xl border border-primary/30 p-6 text-center">
              <Eye className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
                Live Vision
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ARIA describes what your camera sees. Choose <strong>Manual</strong> to scan on demand
                or <strong>Live</strong> for continuous narration.
              </p>
              {lastError && <p className="mt-3 text-xs text-destructive">{lastError}</p>}
              <button
                onClick={() => start()}
                className="mt-4 hud-corner inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-primary hover:bg-primary/25"
              >
                <Camera className="h-4 w-4" /> Enable
              </button>
            </div>
          </div>
        )}

        {/* Live captions */}
        {active && samples[0] && (
          <div className="absolute inset-x-3 bottom-32 flex flex-col items-start gap-1.5">
            <AnimatePresence mode="popLayout">
              {samples.slice(0, 3).map((s, i) => (
                <motion.div
                  key={s.at}
                  layout
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1 - i * 0.35, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="hud-corner max-w-[80%] rounded-lg border border-primary/30 bg-background/75 px-3 py-2 font-mono text-[13px] text-foreground backdrop-blur"
                >
                  {s.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {thinking && (
          <div className="absolute right-3 top-14 flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> analyzing
          </div>
        )}
      </div>

      {/* Bottom bar: Scan Now + Ask */}
      {active && (
        <div className="border-t border-primary/15 bg-background/85 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => analyzeOnce()}
                disabled={thinking}
                whileTap={{ scale: 0.94 }}
                className="hud-corner flex flex-1 items-center justify-center gap-2 rounded-full border border-primary bg-primary/20 py-3 font-display text-xs uppercase tracking-[0.3em] text-primary transition hover:bg-primary/30 disabled:opacity-50"
                aria-label="Scan now"
              >
                <Scan className="h-4 w-4" />
                {thinking ? "Scanning…" : "Scan Now"}
              </motion.button>
              <button
                type="button"
                onClick={() => stop()}
                className="grid h-12 w-12 place-items-center rounded-full border border-destructive/50 bg-destructive/15 text-destructive"
                aria-label="Stop camera"
              >
                <CameraOff className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = askInput.trim();
                if (!q) return;
                void analyzeOnce(q);
                setAskInput("");
              }}
              className="flex items-center gap-2"
            >
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="Ask about what you see…"
                className="flex-1 rounded-lg border border-primary/30 bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
