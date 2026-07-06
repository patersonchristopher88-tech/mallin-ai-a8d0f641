import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Scan,
  Infinity as InfinityIcon,
  Hand,
  History,
  ShieldCheck,
  QrCode,
  FileText as DocIcon,
  Leaf,
  Landmark,
  UtensilsCrossed,
  ScanText,
  Boxes,
  Sparkles,
  Zap,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vision")({
  ssr: false,
  head: () => ({ meta: [{ title: "Vision Pro — ARIA" }] }),
  component: VisionPro,
});

type ScanMode =
  | "auto"
  | "qr"
  | "document"
  | "object"
  | "plant"
  | "food"
  | "landmark"
  | "text";

const MODES: Array<{ id: ScanMode; label: string; icon: React.ElementType; prompt: string }> = [
  {
    id: "auto",
    label: "Auto",
    icon: Sparkles,
    prompt:
      "Identify what is in view. If it's an object, plant, animal, food, landmark, product, or contains text, say which and give the key facts a user would want. Be concise, factual, cinematic. If a factual claim is worth verifying, mark it clearly.",
  },
  {
    id: "qr",
    label: "QR / Barcode",
    icon: QrCode,
    prompt:
      "Look for any QR code, barcode, or scannable code in the frame. Read and decode the payload if visible. State what the code contains and (if it's a URL) whether it appears safe.",
  },
  {
    id: "document",
    label: "Document",
    icon: DocIcon,
    prompt:
      "Treat the frame as a document. Perform OCR: transcribe all readable text exactly, preserving line breaks. Then give a 1-sentence summary of what the document is.",
  },
  {
    id: "object",
    label: "Object",
    icon: Boxes,
    prompt:
      "Identify the main object(s). Give: name, category, likely brand/model if visible, materials, typical use, and one interesting fact.",
  },
  {
    id: "plant",
    label: "Plant / Animal",
    icon: Leaf,
    prompt:
      "Identify the plant, animal, or organism. Give: common name, scientific name, family, habitat, care/behavior notes, and any safety warnings (toxicity, danger).",
  },
  {
    id: "food",
    label: "Food",
    icon: UtensilsCrossed,
    prompt:
      "Identify the food or dish. Give: name, cuisine of origin, main ingredients, rough calorie estimate per serving, and dietary notes (vegan/gluten/allergens).",
  },
  {
    id: "landmark",
    label: "Landmark / Car",
    icon: Landmark,
    prompt:
      "Identify the landmark, building, monument, or vehicle. Give: name, location or make/model, year/era, historical or technical significance.",
  },
  {
    id: "text",
    label: "Read text",
    icon: ScanText,
    prompt:
      "Transcribe every visible piece of text in the frame exactly. If it's a sign, label, or menu, translate to English if not already.",
  },
];

type ScanEntry = {
  id: string;
  at: number;
  mode: ScanMode;
  text: string;
  thumb: string;
};

type FactCheck = {
  verdict: "supported" | "mixed" | "unsupported" | "unknown";
  confidence: number;
  reasoning: string;
  flagged_misinformation: boolean;
  sources: Array<{ title: string; url: string; snippet: string }>;
};

const HISTORY_KEY = "aria:vision:history";

function loadHistory(): ScanEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as ScanEntry[];
  } catch {
    return [];
  }
}
function saveHistory(entries: ScanEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30)));
  } catch {
    /* ignore */
  }
}

function VisionPro() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [runMode, setRunMode] = useState<"manual" | "continuous">("manual");
  const [scanMode, setScanMode] = useState<ScanMode>("auto");
  const [speak, setSpeak] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [active, setActive] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [current, setCurrent] = useState<ScanEntry | null>(null);
  const [factCheck, setFactCheck] = useState<FactCheck | null>(null);
  const [factChecking, setFactChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setTorchOn(false);
    setFrozen(false);
  }, []);

  const start = useCallback(async () => {
    try {
      setLastError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera denied";
      setLastError(msg);
      toast.error(msg);
    }
  }, [facingMode]);

  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const maxW = 900;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.78);
  }, []);

  const analyze = useCallback(
    async (overridePrompt?: string) => {
      if (inflightRef.current) return;
      const frame = captureFrame();
      if (!frame) return;
      inflightRef.current = true;
      setThinking(true);
      setFactCheck(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const modeDef = MODES.find((m) => m.id === scanMode)!;
        const prompt = overridePrompt?.trim() || modeDef.prompt;
        const res = await fetch("/api/vision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ imageBase64: frame, prompt, brief: false }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { text } = (await res.json()) as { text: string };
        if (!text) return;
        const entry: ScanEntry = {
          id: `${Date.now()}`,
          at: Date.now(),
          mode: scanMode,
          text,
          thumb: frame,
        };
        setCurrent(entry);
        setHistory((h) => {
          const next = [entry, ...h].slice(0, 30);
          saveHistory(next);
          return next;
        });
        navigator.vibrate?.(8);
        if (speak) {
          try {
            const t = await fetch("/api/tts/lovable", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ text, voice: "alloy" }),
            });
            if (t.ok) {
              const blob = await t.blob();
              const url = URL.createObjectURL(blob);
              audioRef.current?.pause();
              const a = new Audio(url);
              audioRef.current = a;
              a.play().catch(() => {});
              a.onended = () => URL.revokeObjectURL(url);
            }
          } catch {
            /* speak best-effort */
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analyze failed";
        setLastError(msg);
        toast.error(msg);
      } finally {
        setThinking(false);
        inflightRef.current = false;
      }
    },
    [captureFrame, scanMode, speak],
  );

  // Continuous mode timer.
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (active && runMode === "continuous" && !frozen) {
      timerRef.current = window.setInterval(() => void analyze(), 3800);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [active, runMode, frozen, analyze]);

  async function runFactCheck() {
    if (!current || factChecking) return;
    setFactChecking(true);
    setFactCheck(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/vision-factcheck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ claim: current.text.slice(0, 500) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const fc = (await res.json()) as FactCheck;
      setFactCheck(fc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fact-check failed");
    } finally {
      setFactChecking(false);
    }
  }

  async function swapCamera() {
    stop();
    setFacingMode((f) => (f === "user" ? "environment" : "user"));
    setTimeout(() => void start(), 250);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    if (!caps.torch) return toast.error("Torch not supported on this device");
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
      setTorchOn((t) => !t);
    } catch {
      toast.error("Couldn't toggle torch");
    }
  }

  function freezeFrame() {
    setFrozen((f) => !f);
    const v = videoRef.current;
    if (!v) return;
    if (!frozen) v.pause();
    else void v.play();
  }

  function clearHistory() {
    saveHistory([]);
    setHistory([]);
    toast.success("History cleared");
  }

  const activeMode = useMemo(() => MODES.find((m) => m.id === scanMode)!, [scanMode]);

  return (
    <main className="relative z-10 flex min-h-screen flex-col bg-black">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <Link to="/chat" className="flex items-center gap-2 text-primary/80">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-xs uppercase tracking-[0.3em]">Vision Pro</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-full border border-primary/30 bg-card/60 p-0.5">
            <button
              onClick={() => setRunMode("manual")}
              className={`flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                runMode === "manual" ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
            >
              <Hand className="h-3 w-3" /> Manual
            </button>
            <button
              onClick={() => setRunMode("continuous")}
              className={`flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                runMode === "continuous" ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
            >
              <InfinityIcon className="h-3 w-3" /> Live
            </button>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            aria-label="History"
            className="grid h-9 w-9 place-items-center rounded-full border border-primary/40 bg-card/60 text-primary"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mode strip */}
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-primary/10 bg-background/70 px-3 py-2 backdrop-blur">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = scanMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setScanMode(m.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                on
                  ? "border-primary bg-primary/20 text-primary hud-text-glow"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Icon className="h-3 w-3" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Camera stage */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
          muted
          playsInline
        />

        {/* HUD reticle */}
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-primary" />
          <span className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-primary" />
          <span className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-primary" />
          <span className="absolute right-3 bottom-3 h-6 w-6 border-b-2 border-r-2 border-primary" />
          {active && runMode === "continuous" && !frozen && (
            <motion.div
              className="absolute inset-x-0 h-[2px] bg-primary/70"
              style={{ boxShadow: "0 0 12px hsl(var(--primary))" }}
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}
            />
          )}
          {thinking && (
            <motion.div
              className="absolute inset-x-0 h-[2px] bg-accent"
              style={{ boxShadow: "0 0 12px hsl(var(--accent))" }}
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
          )}
          <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          <div className="absolute left-3 top-14 rounded-full border border-primary/30 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary/90">
            {activeMode.label}
          </div>
          {thinking && (
            <div className="absolute right-3 top-14 flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> analyzing
            </div>
          )}
        </div>

        {!active && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur">
            <div className="hud-corner max-w-xs rounded-2xl border border-primary/30 bg-card/70 p-6 text-center">
              <Camera className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
                Vision Pro
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Point your camera at anything. ARIA identifies, reads, and cross-checks it.
              </p>
              {lastError && <p className="mt-3 text-xs text-destructive">{lastError}</p>}
              <button
                onClick={() => void start()}
                className="mt-4 hud-corner inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-primary hover:bg-primary/25"
              >
                <Camera className="h-4 w-4" /> Enable
              </button>
            </div>
          </div>
        )}

        {/* Latest result overlay */}
        <AnimatePresence>
          {active && current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-3 bottom-36 max-h-[45%] overflow-y-auto rounded-xl border border-primary/30 bg-background/85 p-3 backdrop-blur"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80">
                  {MODES.find((m) => m.id === current.mode)?.label}
                </span>
                <button
                  onClick={() => setCurrent(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {current.text}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={runFactCheck}
                  disabled={factChecking}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-accent disabled:opacity-40"
                >
                  {factChecking ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  Fact-check
                </button>
                <button
                  onClick={() => {
                    const q = window.prompt("Ask a follow-up about this scan:");
                    if (q) void analyze(q);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary"
                >
                  <Zap className="h-3 w-3" /> Follow-up
                </button>
              </div>
              {factCheck && (
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-2">
                  <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                    <span
                      className={
                        factCheck.verdict === "supported"
                          ? "text-emerald-400"
                          : factCheck.verdict === "unsupported"
                            ? "text-destructive"
                            : factCheck.verdict === "mixed"
                              ? "text-amber-400"
                              : "text-muted-foreground"
                      }
                    >
                      {factCheck.verdict}
                    </span>
                    <span className="text-muted-foreground">
                      confidence {(factCheck.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[12px] leading-snug text-foreground">{factCheck.reasoning}</p>
                  {factCheck.flagged_misinformation && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-destructive">
                      ⚠ possible misinformation
                    </p>
                  )}
                  {factCheck.sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {factCheck.sources.slice(0, 4).map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 truncate text-[11px] text-primary/90 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      {active && (
        <div className="border-t border-primary/15 bg-background/90 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => void analyze()}
                disabled={thinking}
                whileTap={{ scale: 0.94 }}
                className="hud-corner flex flex-1 items-center justify-center gap-2 rounded-full border border-primary bg-primary/20 py-3 font-display text-xs uppercase tracking-[0.3em] text-primary transition disabled:opacity-50"
              >
                <Scan className="h-4 w-4" />
                {thinking ? "Scanning…" : "Scan Now"}
              </motion.button>
              <button
                onClick={freezeFrame}
                className={`grid h-12 w-12 place-items-center rounded-full border ${
                  frozen
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-primary/30 bg-card/60 text-primary"
                }`}
                aria-label="Freeze frame"
                title="Freeze"
              >
                <span className="font-mono text-[10px]">{frozen ? "▶" : "❚❚"}</span>
              </button>
              <button
                onClick={toggleTorch}
                className={`grid h-12 w-12 place-items-center rounded-full border ${
                  torchOn
                    ? "border-amber-400 bg-amber-400/20 text-amber-300"
                    : "border-primary/30 bg-card/60 text-primary"
                }`}
                aria-label="Torch"
                title="Torch"
              >
                <Zap className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSpeak((s) => !s)}
                className={`grid h-12 w-12 place-items-center rounded-full border ${
                  speak
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-card/60 text-muted-foreground"
                }`}
                aria-label="Toggle voice"
              >
                {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                onClick={() => void swapCamera()}
                className="grid h-12 w-12 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary"
                aria-label="Flip"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={stop}
                className="grid h-12 w-12 place-items-center rounded-full border border-destructive/50 bg-destructive/15 text-destructive"
                aria-label="Stop"
              >
                <CameraOff className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = askInput.trim();
                if (!q) return;
                void analyze(q);
                setAskInput("");
              }}
              className="flex items-center gap-2"
            >
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder={`Ask about this ${activeMode.label.toLowerCase()}…`}
                className="flex-1 rounded-lg border border-primary/30 bg-card/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </form>
          </div>
        </div>
      )}

      {/* History drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur"
            onClick={() => setShowHistory(false)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-primary/25 bg-background/95 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm uppercase tracking-[0.3em] text-primary">
                  Scan History
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearHistory}
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-destructive"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 text-primary"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none h-[calc(100%-3rem)] space-y-2 overflow-y-auto pr-1">
                {history.length === 0 ? (
                  <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    No scans yet
                  </p>
                ) : (
                  history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setCurrent(h);
                        setShowHistory(false);
                      }}
                      className="flex w-full gap-2 rounded-lg border border-primary/20 bg-card/50 p-2 text-left hover:border-primary/50"
                    >
                      <img
                        src={h.thumb}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-primary/80">
                            {MODES.find((m) => m.id === h.mode)?.label}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {new Date(h.at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[11px] text-foreground/90">{h.text}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
