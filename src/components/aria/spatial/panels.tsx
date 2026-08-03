import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  Loader2,
  Pin,
  Sparkles,
  Trash2,
  Plus,
  Wind,
  Droplets,
  Thermometer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export async function spatialCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/spatial", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-primary/80">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
    </div>
  );
}

/* ------------------------------------------------------------------- news */

interface Article {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string;
  snippet: string;
}

export function NewsPanel({ topic }: { topic?: string }) {
  const [items, setItems] = useState<Article[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    spatialCall<{ items: Article[] }>({ action: "news", topic })
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e instanceof Error ? e.message : "News unavailable"));
  }, [topic]);

  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (!items) return <Spinner label="Fetching headlines…" />;

  const visible = items.filter((a) => !dismissed.has(a.id));
  const ordered = [...visible].sort(
    (a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)),
  );

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
        {topic ? `${topic} · ` : ""}
        {ordered.length} stories · drag a card away to dismiss
      </p>
      {ordered.map((a) => (
        <motion.div
          key={a.id}
          layout
          drag="x"
          dragConstraints={{ left: -40, right: 40 }}
          dragElastic={0.4}
          onDragEnd={(_e, info) => {
            if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 700) {
              setDismissed((s) => new Set(s).add(a.id));
            }
          }}
          className={cn(
            "cursor-grab rounded-lg border p-2 active:cursor-grabbing",
            pinned.has(a.id) ? "border-amber-400/60 bg-amber-400/5" : "border-primary/20 bg-background/40",
          )}
        >
          <p className="text-[13px] font-medium leading-snug text-foreground">{a.title}</p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {a.source || "wire"} · {a.published?.slice(5, 16)}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={async () => {
                setBusy(a.id);
                try {
                  const d = await spatialCall<{ text: string }>({
                    action: "summarize",
                    query: a.title,
                    text: a.snippet,
                  });
                  setSummary({ id: a.id, text: d.text });
                } finally {
                  setBusy(null);
                }
              }}
              className="inline-flex items-center gap-1 rounded border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary hover:bg-primary/15"
            >
              {busy === a.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
              Summarise
            </button>
            <button
              onClick={() =>
                setPinned((s) => {
                  const n = new Set(s);
                  if (n.has(a.id)) n.delete(a.id);
                  else n.add(a.id);
                  return n;
                })
              }
              className="rounded border border-primary/20 p-1 text-muted-foreground hover:text-amber-300"
              aria-label="Pin story"
            >
              <Pin className="h-2.5 w-2.5" />
            </button>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-primary/20 p-1 text-muted-foreground hover:text-primary"
                aria-label="Open article"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <button
              onClick={() => setDismissed((s) => new Set(s).add(a.id))}
              className="rounded border border-primary/20 p-1 text-muted-foreground hover:text-destructive"
              aria-label="Dismiss story"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
          {summary?.id === a.id && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 whitespace-pre-wrap border-t border-primary/20 pt-2 text-[11px] leading-relaxed text-muted-foreground"
            >
              {summary.text}
            </motion.p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- weather */

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  61: "Rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Snow",
  80: "Showers",
  95: "Thunderstorm",
};

export function WeatherPanel() {
  const [data, setData] = useState<{
    current: Record<string, number>;
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = (lat?: number, lon?: number) =>
      spatialCall<typeof data>({ action: "weather", lat, lon })
        .then((d) => setData(d))
        .catch((e) => setErr(e instanceof Error ? e.message : "Weather unavailable"));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => load(p.coords.latitude, p.coords.longitude),
        () => load(),
        { timeout: 4000 },
      );
    } else load();
  }, []);

  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (!data) return <Spinner label="Reading atmosphere…" />;

  const c = data.current;
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-4xl text-primary hud-text-glow">{Math.round(c.temperature_2m)}°</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {WMO[c.weather_code] ?? "—"} · feels {Math.round(c.apparent_temperature)}°
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wind className="h-3 w-3 text-primary" /> {Math.round(c.wind_speed_10m)}km/h
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="h-3 w-3 text-primary" /> {c.relative_humidity_2m}%
        </span>
        <span className="flex items-center gap-1">
          <Thermometer className="h-3 w-3 text-primary" /> {c.precipitation}mm
        </span>
      </div>
      <div className="space-y-1">
        {data.daily.time.slice(0, 5).map((d, i) => (
          <div key={d} className="flex items-center justify-between border-b border-primary/10 py-1 text-[11px]">
            <span className="text-muted-foreground">
              {new Date(d).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="font-mono text-[10px] text-primary/70">
              {WMO[data.daily.weather_code[i]] ?? "—"}
            </span>
            <span className="font-mono text-foreground">
              {Math.round(data.daily.temperature_2m_min[i])}° / {Math.round(data.daily.temperature_2m_max[i])}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- AI briefing panel */

export function BriefPanel({ prompt, placeholder }: { prompt: string; placeholder: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    spatialCall<{ text: string }>({ action: "brief", query: prompt })
      .then((d) => setText(d.text))
      .catch((e) => setErr(e instanceof Error ? e.message : "Unavailable"));
  }, [prompt]);

  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (!text) return <Spinner label={placeholder} />;
  return <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{text}</p>;
}

export function SearchPanel({ query }: { query: string }) {
  const [res, setRes] = useState<{ text: string; snippets: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    spatialCall<{ text: string; snippets: string[] }>({ action: "search", query })
      .then(setRes)
      .catch((e) => setErr(e instanceof Error ? e.message : "Search failed"));
  }, [query]);

  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (!res) return <Spinner label={`Searching “${query}”…`} />;
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{res.text}</p>
      <div className="space-y-1 border-t border-primary/15 pt-2">
        {res.snippets.map((s, i) => (
          <p key={i} className="font-mono text-[10px] text-muted-foreground">
            · {s}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- notes */

export function NotesPanel({ id }: { id: string }) {
  const key = `aria.spatial.notes.${id}`;
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(localStorage.getItem(key) ?? "");
  }, [key]);
  return (
    <textarea
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        localStorage.setItem(key, e.target.value);
      }}
      placeholder="Spatial scratchpad — autosaved."
      className="h-full w-full resize-none rounded-lg border border-primary/20 bg-background/40 p-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/60"
    />
  );
}

/* ------------------------------------------------------------------- tasks */

interface Task {
  id: string;
  text: string;
  done: boolean;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    try {
      setTasks(JSON.parse(localStorage.getItem("aria.spatial.tasks") ?? "[]"));
    } catch {
      setTasks([]);
    }
  }, []);
  const save = (next: Task[]) => {
    setTasks(next);
    localStorage.setItem("aria.spatial.tasks", JSON.stringify(next));
  };
  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          save([{ id: crypto.randomUUID(), text: draft.trim(), done: false }, ...tasks]);
          setDraft("");
        }}
        className="flex gap-1"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add task"
          className="min-w-0 flex-1 rounded border border-primary/25 bg-background/50 px-2 py-1 text-[12px] outline-none focus:border-primary/60"
        />
        <button className="rounded border border-primary/40 px-2 text-primary" aria-label="Add task">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>
      {tasks.map((t) => (
        <label key={t.id} className="flex items-center gap-2 border-b border-primary/10 py-1 text-[12px]">
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => save(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
            className="accent-[hsl(var(--mood))]"
          />
          <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>{t.text}</span>
          <button
            onClick={() => save(tasks.filter((x) => x.id !== t.id))}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </label>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- shortcuts */

export function ShortcutPanel({
  items,
}: {
  items: { to: string; label: string; desc: string }[];
}) {
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <Link
          key={i.to + i.label}
          to={i.to}
          className="block rounded-lg border border-primary/20 bg-background/40 p-2 hover:border-primary/60"
        >
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-primary">{i.label}</p>
          <p className="text-[11px] text-muted-foreground">{i.desc}</p>
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- calendar */

export function CalendarPanel() {
  const now = new Date();
  const [month] = useState(now.getMonth());
  const first = new Date(now.getFullYear(), month, 1).getDay();
  const days = new Date(now.getFullYear(), month + 1, 0).getDate();
  return (
    <div className="space-y-2">
      <p className="font-display text-[11px] uppercase tracking-[0.25em] text-primary">
        {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: (first + 6) % 7 }).map((_, i) => (
          <span key={`pad${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1;
          const today = d === now.getDate();
          return (
            <span
              key={d}
              className={cn(
                "rounded py-1 text-[10px]",
                today ? "bg-primary text-primary-foreground" : "text-foreground/80",
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
      <div className="border-t border-primary/15 pt-2">
        <ShortcutPanel
          items={[{ to: "/reminders", label: "Reminders", desc: "Open ARIA's scheduled reminders" }]}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fitness */

export function FitnessPanel() {
  const rings = [
    { label: "Move", value: 0.72, color: "hsl(var(--mood))" },
    { label: "Exercise", value: 0.46, color: "#ffb547" },
    { label: "Stand", value: 0.9, color: "#5ce1a6" },
  ];
  return (
    <div className="space-y-3">
      {rings.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>{r.label}</span>
            <span>{Math.round(r.value * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${r.value * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: r.color }}
            />
          </div>
        </div>
      ))}
      <p className="font-mono text-[10px] text-muted-foreground">
        Connect a wearable in Settings to stream live metrics into this panel.
      </p>
    </div>
  );
}
