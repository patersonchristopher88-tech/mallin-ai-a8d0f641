import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Brain,
  Settings as SettingsIcon,
  PhoneOff,
  Loader2,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JarvisOrb, type OrbState } from "@/components/aria/JarvisOrb";
import { useCallMode } from "@/lib/aria/useCallMode";
import { useLiveVision } from "@/lib/aria/useLiveVision";
import { addMemory } from "@/lib/aria/memories.functions";
import { createReminder } from "@/lib/aria/reminders.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/call")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Voice Call — ARIA" },
      {
        name: "description",
        content: "Speak naturally with ARIA in a cinematic fullscreen voice call.",
      },
      { property: "og:title", content: "Voice Call — ARIA" },
      {
        property: "og:description",
        content: "A live, hands-free voice call with your ARIA companion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallPage,
});

type Turn = { role: "user" | "assistant"; content: string };

type Summary = {
  headline: string;
  topics: string[];
  actions: string[];
  reminders: string[];
  memories: string[];
};

const BOOT_LINES = [
  "Loading Neural Core",
  "Voice Engine Online",
  "Memory Vault Synced",
  "Vision Module Ready",
];

/** Soft futuristic startup chime, synthesised (no asset needed). */
function playStartupChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.4);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    [196, 392, 587.33, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i > 1 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.01, now + 2.4);
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.5 / (i + 1), now + 0.5 + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(g);
      g.connect(master);
      osc.start(now + i * 0.14);
      osc.stop(now + 2.8);
    });
    setTimeout(() => void ctx.close().catch(() => {}), 3200);
  } catch {
    /* audio blocked */
  }
}

function CallPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"boot" | "live" | "summary">("boot");
  const [bootStep, setBootStep] = useState(0);

  // Call state
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [caption, setCaption] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [visionOn, setVisionOn] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summarising, setSummarising] = useState(false);

  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const speakerRef = useRef(true);
  speakerRef.current = speakerOn;
  const busyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const greetedRef = useRef(false);

  const addMemoryFn = useServerFn(addMemory);
  const createReminderFn = useServerFn(createReminder);

  const vision = useLiveVision({
    facingMode: "environment",
    intervalMs: 6000,
    brief: true,
    speak: false,
  });
  const visionNoteRef = useRef<string | null>(null);
  visionNoteRef.current = visionOn ? (vision.samples[0]?.text ?? null) : null;

  /* ---------------- boot sequence ---------------- */
  useEffect(() => {
    playStartupChime();
    const timers = BOOT_LINES.map((_, i) =>
      window.setTimeout(() => setBootStep(i + 1), 420 + i * 480),
    );
    const done = window.setTimeout(() => setPhase("live"), 2600);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, []);

  /* ---------------- duration ticker ---------------- */
  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  /* ---------------- speech playback ---------------- */
  const speak = useCallback(async (text: string) => {
    if (!speakerRef.current) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/tts/lovable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, voice: "shimmer" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;

      // Analyser for speech-reactive orb.
      if (!analyserRef.current) {
        try {
          const Ctx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const src = ctx.createMediaElementSource(audio);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyser.connect(ctx.destination);
            analyserRef.current = analyser;
          }
        } catch {
          /* analyser unavailable */
        }
      }

      setOrbState("speaking");
      await audio.play().catch(() => {});

      const analyser = analyserRef.current;
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          setAmplitude(Math.min(1, sum / buf.length / 110));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      }

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAmplitude(0);
      URL.revokeObjectURL(url);
    } catch {
      /* stay silent, captions still show */
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) {
      a.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAmplitude(0);
    }
  }, []);

  /* ---------------- ask ARIA ---------------- */
  const ask = useCallback(
    async (userText: string | null, opts?: { greeting?: boolean }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const t0 = performance.now();
      const next: Turn[] = userText
        ? [...turnsRef.current, { role: "user", content: userText }]
        : [...turnsRef.current];
      if (userText) setTurns(next);
      setOrbState("thinking");
      setCaption("");
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const payload: Turn[] = opts?.greeting
          ? [
              {
                role: "user",
                content:
                  "(The voice call just connected. Greet me warmly in one or two spoken sentences, naturally referencing what we last worked on if you remember it, and ask what I'd like to do.)",
              },
            ]
          : next;
        const res = await fetch("/api/call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: payload, visionNote: visionNoteRef.current }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { text } = (await res.json()) as { text: string };
        setLatency(Math.round(performance.now() - t0));
        setCaption(text);
        setTurns((prev) => [...prev, { role: "assistant", content: text }]);
        await speak(text);
        setOrbState("idle");
      } catch (err) {
        setOrbState("alert");
        toast.error(err instanceof Error ? err.message : "ARIA couldn't respond");
        window.setTimeout(() => setOrbState("idle"), 1400);
      } finally {
        busyRef.current = false;
      }
    },
    [speak],
  );

  /* ---------------- continuous listening ---------------- */
  const onFinal = useCallback(
    (text: string) => {
      if (mutedRef.current) return;
      void ask(text);
    },
    [ask],
  );
  const onInterim = useCallback(() => {
    if (mutedRef.current) return;
    stopSpeaking();
    if (!busyRef.current) setOrbState("listening");
  }, [stopSpeaking]);

  const listener = useCallMode({ onFinal, onInterim });
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (phase !== "live" || greetedRef.current) return;
    greetedRef.current = true;
    listenerRef.current.start();
    void ask(null, { greeting: true });
  }, [phase, ask]);

  useEffect(() => {
    if (muted) listenerRef.current.stop();
    else if (phase === "live") listenerRef.current.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  /* ---------------- vision toggle ---------------- */
  useEffect(() => {
    if (visionOn) void vision.start();
    else vision.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visionOn]);

  /* ---------------- end call ---------------- */
  const endCall = useCallback(async () => {
    listenerRef.current.stop();
    stopSpeaking();
    vision.stop();
    setPhase("summary");
    if (turnsRef.current.length < 2) return;
    setSummarising(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: turnsRef.current, mode: "summary" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSummary((await res.json()) as Summary);
    } catch {
      /* summary optional */
    } finally {
      setSummarising(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const saveSummary = useCallback(async () => {
    if (!summary) return;
    try {
      await Promise.all([
        ...summary.memories.map((content) => addMemoryFn({ data: { content } })),
        ...summary.reminders.map((title) => createReminderFn({ data: { title } })),
      ]);
      toast.success("Call summary saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save summary");
    }
    navigate({ to: "/home" });
  }, [summary, addMemoryFn, createReminderFn, navigate]);

  useEffect(
    () => () => {
      listenerRef.current.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  const duration = useMemo(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [elapsed]);

  /* ================= render ================= */
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* ambient field */}
      <AmbientField />

      <AnimatePresence mode="wait">
        {phase === "boot" && <BootSequence key="boot" step={bootStep} />}

        {phase === "live" && (
          <motion.div
            key="live"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full flex-col"
          >
            {/* live status */}
            <div
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] font-mono text-[9px] uppercase tracking-[0.22em] text-primary/70"
              aria-live="polite"
            >
              <Stat label="Connection" value="Stable" ok />
              <Stat label="Voice" value={speakerOn ? "Online" : "Muted"} ok={speakerOn} />
              <Stat label="Memory" value="Synced" ok />
              <Stat label="Vision" value={visionOn ? "Live" : "Ready"} ok />
              <Stat label="Speed" value={latency ? `${latency}ms` : "—"} ok={!!latency} />
              <Stat label="Time" value={duration} ok />
            </div>

            {/* camera stage */}
            <AnimatePresence>
              {visionOn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, height: 0 }}
                  animate={{ opacity: 1, scale: 1, height: "auto" }}
                  exit={{ opacity: 0, scale: 0.94, height: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative mx-4 overflow-hidden rounded-2xl border border-primary/30"
                >
                  <video
                    ref={vision.videoRef}
                    className="h-[38vh] w-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="pointer-events-none absolute inset-0 hud-scanlines" />
                  <div className="absolute left-3 top-3 rounded-full border border-primary/50 bg-background/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-primary backdrop-blur">
                    ARIA Vision Active
                  </div>
                  {vision.samples[0] && (
                    <p className="absolute inset-x-3 bottom-3 rounded-lg border border-primary/25 bg-background/75 px-3 py-1.5 text-center font-mono text-[11px] text-foreground backdrop-blur">
                      {vision.samples[0].text}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* orb + identity */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              <motion.div
                animate={{ scale: visionOn ? 0.5 : 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <JarvisOrb state={orbState} amplitude={amplitude} size={288} />
              </motion.div>

              {!visionOn && (
                <div className="text-center">
                  <h1 className="font-display text-3xl uppercase tracking-[0.42em] text-primary hud-text-glow">
                    ARIA
                  </h1>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
                    Connected
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    Voice Call Active
                  </p>
                </div>
              )}

              {/* captions */}
              <div className="min-h-[3.5rem] w-full max-w-md">
                <AnimatePresence mode="wait">
                  {(listener.interim || caption) && (
                    <motion.p
                      key={listener.interim ? `i:${listener.interim}` : `c:${caption}`}
                      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                      className={cn(
                        "hud-glass rounded-xl border px-4 py-2.5 text-center text-sm leading-snug",
                        listener.interim
                          ? "border-primary/20 text-muted-foreground italic"
                          : "border-primary/35 text-foreground",
                      )}
                    >
                      {listener.interim || caption}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">
                {orbState === "thinking"
                  ? "Thinking…"
                  : orbState === "speaking"
                    ? "Speaking"
                    : muted
                      ? "Microphone muted"
                      : "Listening — just talk"}
              </p>
              {listener.error && (
                <p className="max-w-xs text-center text-[11px] text-destructive">
                  {listener.error} — use a Chromium browser for hands-free listening.
                </p>
              )}
            </div>

            {/* controls */}
            <div className="flex items-end justify-center gap-2.5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
              <Control
                label="Mute"
                active={muted}
                onClick={() => setMuted((m) => !m)}
                icon={muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              />
              <Control
                label="Speaker"
                active={speakerOn}
                onClick={() => {
                  setSpeakerOn((s) => !s);
                  stopSpeaking();
                }}
                icon={speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              />
              <Control
                label="Vision"
                active={visionOn}
                onClick={() => setVisionOn((v) => !v)}
                icon={<Camera className="h-5 w-5" />}
              />
              <Control
                label="Memory"
                active={memoryOpen}
                onClick={() => setMemoryOpen(true)}
                icon={<Brain className="h-5 w-5" />}
              />
              <Control
                label="Settings"
                onClick={() => navigate({ to: "/settings" })}
                icon={<SettingsIcon className="h-5 w-5" />}
              />
              <Control
                label="End"
                destructive
                onClick={() => void endCall()}
                icon={<PhoneOff className="h-5 w-5" />}
              />
            </div>
          </motion.div>
        )}

        {phase === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full flex-col items-center justify-center px-5"
          >
            <div className="hud-glass hud-corner w-full max-w-md rounded-2xl border border-primary/30 p-5">
              <h2 className="font-display text-lg uppercase tracking-[0.3em] text-primary hud-text-glow">
                Call Summary
              </h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Duration {duration}
              </p>

              {summarising ? (
                <div className="mt-6 flex items-center gap-2 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-mono text-xs uppercase tracking-widest">Compiling…</span>
                </div>
              ) : summary ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-foreground">{summary.headline}</p>
                  <SummaryList title="Topics discussed" items={summary.topics} />
                  <SummaryList title="Actions completed" items={summary.actions} />
                  <SummaryList title="Reminders created" items={summary.reminders} />
                  <SummaryList title="Memories saved" items={summary.memories} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Call ended. Nothing substantial to summarise.
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => void saveSummary()}
                  disabled={!summary}
                  className="hud-corner inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary bg-primary/15 px-4 py-2.5 font-display text-xs uppercase tracking-widest text-primary transition hover:bg-primary/25 disabled:opacity-40"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={() => navigate({ to: "/home" })}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 font-display text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" /> Discard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* memory peek */}
      <AnimatePresence>
        {memoryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 grid place-items-end bg-background/60 backdrop-blur-sm"
            onClick={() => setMemoryOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="hud-glass max-h-[60vh] w-full overflow-y-auto rounded-t-2xl border-t border-primary/30 p-5"
            >
              <h3 className="font-display text-sm uppercase tracking-[0.28em] text-primary">
                Live transcript
              </h3>
              <ul className="mt-3 space-y-2">
                {turns.length === 0 && (
                  <li className="text-sm text-muted-foreground">Nothing said yet.</li>
                )}
                {turns.map((t, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
                      {t.role === "user" ? "You" : "ARIA"}
                    </span>
                    <p className="text-foreground">{t.content}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function BootSequence({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.6 }}
      className="relative flex h-full flex-col items-center justify-center gap-6 px-8"
    >
      <motion.div
        initial={{ scale: 0.2, opacity: 0, filter: "blur(24px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <JarvisOrb state="thinking" size={200} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, letterSpacing: "1em" }}
        animate={{ opacity: 1, letterSpacing: "0.4em" }}
        transition={{ duration: 1.4 }}
        className="font-display text-sm uppercase text-primary hud-text-glow"
      >
        Initializing ARIA…
      </motion.h1>
      <ul className="w-full max-w-xs space-y-1.5 font-mono text-[11px] uppercase tracking-[0.18em]">
        {BOOT_LINES.map((line, i) => (
          <li
            key={line}
            className={cn(
              "flex items-center justify-between transition-opacity duration-500",
              step > i ? "text-primary/90 opacity-100" : "text-muted-foreground opacity-30",
            )}
          >
            <span>{line}</span>
            <span>{step > i ? "OK" : "···"}</span>
          </li>
        ))}
      </ul>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: step >= BOOT_LINES.length ? 1 : 0 }}
        className="font-display text-xs uppercase tracking-[0.34em] text-primary hud-text-glow"
      >
        Connection Established
      </motion.p>
    </motion.div>
  );
}

function AmbientField() {
  const dots = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        size: 1 + (i % 3),
        dur: 8 + (i % 7) * 1.6,
        delay: (i % 9) * 0.7,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, hsl(var(--mood) / 0.16) 0%, transparent 62%)",
        }}
      />
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute rounded-full bg-primary/50"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size }}
          animate={{ y: [0, -28, 0], opacity: [0.15, 0.75, 0.15] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0 hud-scanlines opacity-40" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, black 100%)" }}
      />
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-primary shadow-[0_0_8px_hsl(var(--mood))]" : "bg-muted-foreground/50",
        )}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-primary/90">{value}</span>
    </span>
  );
}

function Control({
  label,
  icon,
  onClick,
  active,
  destructive,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="group flex w-[3.4rem] flex-col items-center gap-1"
    >
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full border transition-all duration-300 active:scale-95",
          destructive
            ? "border-destructive/60 bg-destructive/15 text-destructive shadow-[0_0_18px_hsl(var(--destructive)/0.4)]"
            : active
              ? "border-primary bg-primary/25 text-primary shadow-[0_0_22px_hsl(var(--mood)/0.55)]"
              : "border-primary/25 bg-card/50 text-muted-foreground backdrop-blur group-hover:border-primary/50 group-hover:text-primary",
        )}
      >
        {icon}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {items.map((it) => (
            <li key={it} className="text-sm text-foreground">
              • {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
