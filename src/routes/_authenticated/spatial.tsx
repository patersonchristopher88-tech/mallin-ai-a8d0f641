import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Boxes,
  Brain,
  Calendar,
  Cloud,
  FileText,
  Globe,
  Hand,
  Image as ImageIcon,
  LayoutGrid,
  Mic,
  MicOff,
  Music,
  Newspaper,
  Send,
  Sparkles,
  Trophy,
  Activity,
  ListChecks,
  StickyNote,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { HoloPanel, type PanelTransform } from "@/components/aria/spatial/HoloPanel";
import { ModelStage } from "@/components/aria/spatial/ModelStage";
import {
  BriefPanel,
  CalendarPanel,
  FitnessPanel,
  NewsPanel,
  NotesPanel,
  SearchPanel,
  ShortcutPanel,
  TasksPanel,
  WeatherPanel,
  spatialCall,
} from "@/components/aria/spatial/panels";
import { MemoryManager } from "@/components/aria/MemoryManager";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { useHandGestures } from "@/lib/aria/spatial/useHandGestures";
import { PANEL_META, WORKSPACE_LAYOUT, parseIntent, type PanelKind } from "@/lib/aria/spatial/intents";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/spatial")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Spatial Workspace — ARIA" },
      {
        name: "description",
        content:
          "ARIA's holographic spatial workspace: voice and hand-gesture control over floating news, calendar, weather and interactive 3D models.",
      },
      { property: "og:title", content: "ARIA Spatial Workspace" },
      {
        property: "og:description",
        content: "Control holographic panels and 3D models with your voice and hands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpatialPage,
});

interface Panel {
  id: string;
  kind: PanelKind;
  query?: string;
  t: PanelTransform;
}

const ICONS: Record<PanelKind, React.ComponentType<{ className?: string }>> = {
  news: Newspaper,
  calendar: Calendar,
  weather: Cloud,
  projects: LayoutGrid,
  music: Music,
  rugby: Trophy,
  docs: FileText,
  search: Globe,
  image: ImageIcon,
  model: Boxes,
  notes: StickyNote,
  tasks: ListChecks,
  fitness: Activity,
  memory: Brain,
  chat: MessageSquare,
  explain: Sparkles,
};

const QUICK: { kind: PanelKind; label: string }[] = [
  { kind: "news", label: "News" },
  { kind: "weather", label: "Weather" },
  { kind: "calendar", label: "Calendar" },
  { kind: "model", label: "3D Model" },
  { kind: "rugby", label: "Rugby" },
  { kind: "music", label: "Music" },
  { kind: "tasks", label: "Tasks" },
  { kind: "memory", label: "Memory" },
];

const EXAMPLES = [
  "Show me today's news",
  "Show me a 3D model of Earth",
  "Show me the human heart",
  "Show me a rugby scrum",
  "Show me the inside of a V8 engine",
  "Display the weather",
  "Workspace mode",
  "Break it down",
];

function SpatialPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [zTop, setZTop] = useState(10);
  const [focused, setFocused] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aria, setAria] = useState("Spatial workspace online. Speak or type a command.");
  const [dim, setDim] = useState(false);
  const [explodeSignal, setExplodeSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [gestureOn, setGestureOn] = useState(false);

  const recRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const gestures = useHandGestures();
  const panelsRef = useRef<Panel[]>([]);
  panelsRef.current = panels;
  const focusedRef = useRef<string | null>(null);
  focusedRef.current = focused;

  /* ------------------------------------------------------- panel plumbing */

  const spawn = useCallback(
    (kind: PanelKind, query?: string, slot?: number) => {
      setZTop((z) => z + 1);
      const meta = PANEL_META[kind];
      const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(meta.w, vw - 32);
      const h = Math.min(meta.h, vh - 200);
      const idx = slot ?? panelsRef.current.length;
      const cols = Math.max(1, Math.floor((vw - 40) / (w + 20)));
      const x = 20 + (idx % cols) * (w + 20) + (slot === undefined ? Math.random() * 18 : 0);
      const yRow = Math.floor(idx / cols);
      const y = 84 + yRow * 64 + (slot === undefined ? Math.random() * 40 : 0);

      setPanels((p) => [
        ...p,
        {
          id,
          kind,
          query,
          t: {
            x: Math.max(8, Math.min(x, vw - w - 8)),
            y: Math.max(72, Math.min(y, vh - 180)),
            w,
            h,
            rot: 0,
            z: zTop + 1,
            locked: false,
            pinned: false,
          },
        },
      ]);
      setFocused(id);
      return id;
    },
    [zTop],
  );

  const patch = useCallback((id: string, p: Partial<PanelTransform>) => {
    setPanels((prev) => prev.map((x) => (x.id === id ? { ...x, t: { ...x.t, ...p } } : x)));
  }, []);

  const close = useCallback((id: string) => {
    setPanels((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const focus = useCallback((id: string) => {
    setFocused(id);
    setZTop((z) => {
      setPanels((prev) => prev.map((x) => (x.id === id ? { ...x, t: { ...x.t, z: z + 1 } } : x)));
      return z + 1;
    });
  }, []);

  const explain = useCallback(async (partName: string, modelTitle: string, desc: string) => {
    setAria(`${partName} — ${desc}`);
    try {
      const d = await spatialCall<{ text: string }>({
        action: "explain",
        query: `In the context of a ${modelTitle}, explain the ${partName}. Reference: ${desc}`,
      });
      setAria(`${partName}: ${d.text}`);
    } catch {
      /* keep local description */
    }
  }, []);

  /* --------------------------------------------------------- command exec */

  const run = useCallback(
    (input: string) => {
      const intent = parseIntent(input);
      switch (intent.kind) {
        case "workspace":
          setPanels([]);
          WORKSPACE_LAYOUT.forEach((k, i) => setTimeout(() => spawn(k, undefined, i), i * 110));
          setAria("Command centre assembled. Eight panels around you — pinch, drag or speak to arrange them.");
          return;
        case "close-all":
          setPanels((p) => p.filter((x) => x.t.pinned));
          setAria("Room cleared. Pinned panels kept.");
          return;
        case "explode":
          setExplodeSignal((n) => n + 1);
          setAria("Separating the assembly. Tap any component and I'll explain it.");
          return;
        case "collapse":
          setCollapseSignal((n) => n + 1);
          setAria("Reassembled.");
          return;
        case "news":
          setDim(true);
          setTimeout(() => setDim(false), 2600);
          spawn("news", intent.query);
          setAria("Here are today's headlines. Swipe a card away to dismiss it, or ask me to summarise one.");
          return;
        case "model":
          spawn("model", intent.query ?? "earth");
          setAria(
            `Rendering a holographic model of ${intent.query ?? "Earth"}. Say "break it down" for an exploded view.`,
          );
          return;
        case "search":
          spawn("search", intent.query);
          setAria(`Searching the web for “${intent.query}”.`);
          return;
        case "image":
          spawn("image", intent.query);
          setAria("Opening the image forge with your prompt.");
          return;
        case "explain": {
          const model = panelsRef.current.find((p) => p.kind === "model");
          setAria(
            model
              ? "Tap a component in the model and I'll explain exactly what it does."
              : "Open a model first — try “show me a 3D model of a V8 engine”.",
          );
          return;
        }
        case "unknown":
          spawn("search", input);
          setAria(`I wasn't sure which panel you meant, so I searched for “${input}”.`);
          return;
        default:
          spawn(intent.kind as PanelKind, intent.query);
          setAria(`${PANEL_META[intent.kind as PanelKind].title} is open.`);
      }
    },
    [spawn],
  );

  const submit = useCallback(
    (text?: string) => {
      const value = (text ?? command).trim();
      if (!value) return;
      setCommand("");
      run(value);
    },
    [command, run],
  );

  /* ------------------------------------------------------------- voice in */

  const toggleVoice = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser — type your command instead.");
      return;
    }
    const rec = new Ctor() as {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      abort: () => void;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
      onerror: () => void;
      onend: () => void;
    };
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          setTranscript("");
          submit(text);
        } else interim += text;
      }
      if (interim) setTranscript(interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, submit]);

  useEffect(() => () => recRef.current?.abort(), []);

  /* ---------------------------------------------------------- gesture map */

  useEffect(() => {
    if (!gestures.active) return;
    const s = gestures.state;
    const id = focusedRef.current;
    const panel = panelsRef.current.find((p) => p.id === id);
    if (!panel || panel.t.locked) return;

    const primary = s.hands[0];
    if (primary?.grabbed) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      patch(panel.id, {
        x: Math.max(8, Math.min(primary.x * vw - panel.t.w / 2, vw - panel.t.w - 8)),
        y: Math.max(72, Math.min(primary.y * vh - 30, vh - 140)),
      });
    }
    if (s.spread != null) {
      const target = Math.max(220, Math.min(1200, s.spread * 1600));
      patch(panel.id, { w: target, h: Math.max(180, target * 0.8) });
    }
    if (s.rotation != null) {
      patch(panel.id, { rot: Math.max(-30, Math.min(30, (s.rotation * 180) / Math.PI * 0.3)) });
    }
    if (s.gesture === "swipe-left" || s.gesture === "swipe-right") {
      if (!panel.t.pinned) close(panel.id);
    }
  }, [gestures.state, gestures.active, patch, close]);

  const toggleGestures = async () => {
    if (gestures.active) {
      gestures.stop();
      setGestureOn(false);
      return;
    }
    setGestureOn(true);
    await gestures.start();
  };

  useEffect(() => {
    if (gestures.lastError) toast.error(gestures.lastError);
  }, [gestures.lastError]);

  /* ------------------------------------------------------------- rendering */

  const body = (p: Panel) => {
    switch (p.kind) {
      case "news":
        return <NewsPanel topic={p.query} />;
      case "weather":
        return <WeatherPanel />;
      case "calendar":
        return <CalendarPanel />;
      case "tasks":
        return <TasksPanel />;
      case "notes":
        return <NotesPanel id={p.id} />;
      case "fitness":
        return <FitnessPanel />;
      case "memory":
        return <MemoryManager />;
      case "search":
        return <SearchPanel query={p.query ?? ""} />;
      case "model":
        return (
          <ModelStage
            query={p.query ?? "earth"}
            explodeSignal={explodeSignal}
            collapseSignal={collapseSignal}
            onExplain={explain}
          />
        );
      case "rugby":
        return (
          <div className="space-y-2">
            <BriefPanel
              prompt="Give a compact rugby briefing: the current major competitions in play, how the fixture calendar usually runs at this time of year, and what to watch. Do not invent specific scores or dates."
              placeholder="Pulling rugby briefing…"
            />
            <button
              onClick={() => spawn("model", "rugby scrum")}
              className="w-full rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 font-display text-[10px] uppercase tracking-widest text-primary"
            >
              Open 3D scrum analysis
            </button>
          </div>
        );
      case "music":
        return (
          <ShortcutPanel
            items={[
              { to: "/music", label: "Music player", desc: "Search, play and visualise tracks" },
              { to: "/library", label: "Library", desc: "Your saved audio and generations" },
            ]}
          />
        );
      case "projects":
        return (
          <ShortcutPanel
            items={[
              { to: "/projects", label: "Projects hub", desc: "Chats, images, video and files" },
              { to: "/studio", label: "Studio", desc: "45+ creative and productivity tools" },
            ]}
          />
        );
      case "docs":
        return (
          <ShortcutPanel
            items={[
              { to: "/library", label: "Documents", desc: "Uploaded files and parsed docs" },
              { to: "/edit", label: "Image editor", desc: "Inpaint, expand and restyle" },
            ]}
          />
        );
      case "image":
        return (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Prompt captured: <span className="text-foreground">{p.query}</span>
            </p>
            <ShortcutPanel
              items={[{ to: "/studio", label: "Open Studio", desc: "Generate with this prompt in the image forge" }]}
            />
          </div>
        );
      case "chat":
        return <ShortcutPanel items={[{ to: "/chat", label: "ARIA Chat", desc: "Full conversation surface" }]} />;
      default:
        return <BriefPanel prompt={p.query ?? p.kind} placeholder="Thinking…" />;
    }
  };

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* room */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, hsl(var(--mood) / 0.14), transparent 60%), radial-gradient(100% 80% at 50% 110%, hsl(var(--mood) / 0.1), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--mood) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--mood) / 0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            transform: "perspective(420px) rotateX(62deg)",
            transformOrigin: "bottom",
            maskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
      </div>

      <AnimatePresence>
        {dim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="pointer-events-none absolute inset-0 z-[5] bg-background/70"
          />
        )}
      </AnimatePresence>

      {/* header */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-primary/15 bg-background/80 px-3 py-2 backdrop-blur">
        <Link to="/home" className="flex items-center gap-1.5 text-primary/80">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] uppercase tracking-[0.3em] text-primary hud-text-glow">
            Spatial Workspace
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {panels.length} panel{panels.length === 1 ? "" : "s"} · {gestures.active ? "gestures live" : "gestures off"}
          </p>
        </div>
        <button
          onClick={toggleGestures}
          className={cn(
            "rounded-lg border px-2 py-1.5 transition",
            gestures.active ? "border-primary bg-primary/20 text-primary" : "border-primary/25 text-muted-foreground",
          )}
          aria-label="Toggle hand gestures"
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          onClick={() => run("workspace mode")}
          className="rounded-lg border border-primary/25 px-2 py-1.5 text-muted-foreground hover:text-primary"
          aria-label="Workspace mode"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPanels((p) => p.filter((x) => x.t.pinned))}
          className="rounded-lg border border-primary/25 px-2 py-1.5 text-muted-foreground hover:text-destructive"
          aria-label="Clear room"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* panels */}
      <div className="absolute inset-0 z-10">
        <AnimatePresence>
          {panels.map((p) => {
            const Icon = ICONS[p.kind];
            return (
              <HoloPanel
                key={p.id}
                id={p.id}
                title={PANEL_META[p.kind].title}
                subtitle={p.query}
                transform={p.t}
                focused={focused === p.id}
                onChange={patch}
                onClose={close}
                onFocus={focus}
              >
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-primary/50">
                  <Icon className="h-3 w-3" /> live
                </div>
                {body(p)}
              </HoloPanel>
            );
          })}
        </AnimatePresence>
      </div>

      {/* empty state */}
      {panels.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6">
          <div className="text-center">
            <JarvisOrb state={listening ? "listening" : "idle"} size={200} />
            <p className="mt-3 font-display text-sm uppercase tracking-[0.3em] text-primary hud-text-glow">
              Say the word
            </p>
            <div className="pointer-events-auto mt-3 flex max-w-sm flex-wrap justify-center gap-1.5">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => submit(e)}
                  className="rounded-full border border-primary/25 px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:border-primary/60 hover:text-primary"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* gesture cursors */}
      {gestures.active &&
        gestures.state.hands.map((h, i) => (
          <div
            key={i}
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: 34 - h.pinch * 16,
              height: 34 - h.pinch * 16,
              borderColor: h.grabbed ? "#ffb547" : "hsl(var(--mood))",
              boxShadow: "0 0 24px hsl(var(--mood) / 0.7)",
            }}
          />
        ))}
      <video ref={gestures.videoRef} className="pointer-events-none absolute h-px w-px opacity-0" muted playsInline />

      {/* ARIA voice line + dock */}
      <div className="absolute inset-x-0 bottom-0 z-30 space-y-2 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-3 pt-6">
        <AnimatePresence mode="popLayout">
          <motion.p
            key={aria}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-lg text-center text-[12px] leading-relaxed text-primary/90"
          >
            {aria}
          </motion.p>
        </AnimatePresence>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {QUICK.map((q) => {
            const Icon = ICONS[q.kind];
            return (
              <button
                key={q.kind}
                onClick={() => run(q.kind === "model" ? "show me a 3d model of earth" : q.label)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-card/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary/60 hover:text-primary"
              >
                <Icon className="h-3 w-3" /> {q.label}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition",
              listening
                ? "border-primary bg-primary/25 text-primary shadow-[0_0_24px_hsl(var(--mood)/0.6)]"
                : "border-primary/30 text-muted-foreground",
            )}
            aria-label="Toggle voice command"
          >
            {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <input
            value={transcript || command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="ARIA, show me today's news…"
            className="min-w-0 flex-1 rounded-full border border-primary/25 bg-card/60 px-4 py-2.5 text-[13px] outline-none backdrop-blur focus:border-primary/70"
          />
          <button
            type="submit"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary bg-primary/20 text-primary"
            aria-label="Run command"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
