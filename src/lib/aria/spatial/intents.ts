export type PanelKind =
  | "news"
  | "calendar"
  | "weather"
  | "projects"
  | "music"
  | "rugby"
  | "docs"
  | "search"
  | "image"
  | "model"
  | "notes"
  | "tasks"
  | "fitness"
  | "memory"
  | "chat"
  | "explain";

export interface SpatialIntent {
  kind: PanelKind | "workspace" | "explode" | "collapse" | "close-all" | "unknown";
  query?: string;
  raw: string;
}

const RULES: { kind: SpatialIntent["kind"]; re: RegExp; capture?: boolean }[] = [
  { kind: "workspace", re: /\b(workspace mode|command cent(er|re)|full workspace|open everything)\b/ },
  { kind: "explode", re: /\b(break it down|explode|exploded view|take it apart|pull it apart)\b/ },
  { kind: "collapse", re: /\b(put it back|reassemble|collapse|together again)\b/ },
  { kind: "close-all", re: /\b(clear (the )?(room|workspace|everything)|close everything|dismiss all)\b/ },
  // explicit model requests win over everything else
  {
    kind: "model",
    re: /\b(?:3-?d\s+model|3-?d|hologram(?:ic model)?|holo\s*model|model)\s+(?:of\s+)?(?:a\s+|an\s+|the\s+)?(.+)/,
    capture: true,
  },
  { kind: "image", re: /\b(?:generate|create|make|draw)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo)\s+(?:of\s+)?(.+)/, capture: true },
  { kind: "search", re: /\b(?:search (?:the )?web for|google|look up|search for)\s+(.+)/, capture: true },
  { kind: "explain", re: /\b(explain this|what does this (part )?do|tell me about this)\b/ },
  { kind: "news", re: /\b(news|headlines|what'?s happening|current events)\b/ },
  { kind: "calendar", re: /\b(calendar|schedule|agenda|my day)\b/ },
  { kind: "weather", re: /\b(weather|forecast|temperature|rain)\b/ },
  { kind: "rugby", re: /\b(rugby|fixtures|six nations|match schedule)\b/ },
  { kind: "music", re: /\b(spotify|music|play something|playlist|song)\b/ },
  { kind: "projects", re: /\b(projects?|my work|workspaces?)\b/ },
  { kind: "docs", re: /\b(documents?|files?|my docs|library)\b/ },
  { kind: "tasks", re: /\b(tasks?|to.?do|reminders?)\b/ },
  { kind: "fitness", re: /\b(fitness|health|steps|workout|activity)\b/ },
  { kind: "memory", re: /\b(memory vault|memories|what do you know about me)\b/ },
  { kind: "notes", re: /\b(notes?|scratchpad|jot)\b/ },
  { kind: "chat", re: /\b(chat|talk to you|conversation)\b/ },
];

/** Anything the user asks to "show" that isn't a panel keyword becomes a model. */
const SHOW_RE =
  /\b(?:show(?:\s+me)?|display|render|build|visuali[sz]e|bring up|pull up|let me see)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(.+)/;

const PANEL_WORDS =
  /\b(news|headlines|calendar|schedule|agenda|weather|forecast|rugby|fixtures|spotify|music|playlist|projects?|documents?|files?|library|tasks?|to.?do|reminders?|fitness|steps|workout|memor(y|ies)|notes?|chat|web|settings)\b/;

const STRIP =
  /^(?:me\s+|a\s+|an\s+|the\s+|some\s+|detailed\s+|realistic\s+|interactive\s+|holographic\s+|3-?d\s+|model\s+of\s+|inside\s+of\s+)+/;

function cleanQuery(s: string) {
  return s
    .replace(/[.?!]+$/, "")
    .replace(STRIP, "")
    .replace(/^(?:model\s+of|hologram\s+of)\s+/, "")
    .trim();
}

/** Fast, offline intent parser. Returns "unknown" when nothing matches. */
export function parseIntent(input: string): SpatialIntent {
  const raw = input.trim();
  const text = raw
    .toLowerCase()
    .replace(/^(hey |ok |okay |yo |aria[,: ]*|please )+/g, "")
    .trim();

  for (const r of RULES) {
    const m = text.match(r.re);
    if (!m) continue;
    if (r.capture) {
      const q = cleanQuery(m[1] ?? "");
      if (!q) continue;
      return { kind: r.kind, query: q, raw };
    }
    return { kind: r.kind, raw };
  }

  // "show me a lion" / "render a jet engine" → generate a model for it
  const show = text.match(SHOW_RE);
  if (show) {
    const q = cleanQuery(show[1] ?? "");
    if (q && !PANEL_WORDS.test(q)) return { kind: "model", query: q, raw };
  }

  return { kind: "unknown", raw };
}


export const PANEL_META: Record<PanelKind, { title: string; icon: string; w: number; h: number }> = {
  news: { title: "News Board", icon: "newspaper", w: 460, h: 420 },
  calendar: { title: "Calendar", icon: "calendar", w: 340, h: 380 },
  weather: { title: "Weather", icon: "cloud", w: 300, h: 300 },
  projects: { title: "Projects", icon: "folder", w: 340, h: 360 },
  music: { title: "Music", icon: "music", w: 320, h: 300 },
  rugby: { title: "Rugby", icon: "trophy", w: 340, h: 360 },
  docs: { title: "Documents", icon: "file", w: 340, h: 360 },
  search: { title: "Web Search", icon: "globe", w: 400, h: 400 },
  image: { title: "Image Forge", icon: "image", w: 360, h: 400 },
  model: { title: "Holo Model", icon: "box", w: 520, h: 480 },
  notes: { title: "Notes", icon: "pencil", w: 320, h: 320 },
  tasks: { title: "Tasks", icon: "check", w: 320, h: 340 },
  fitness: { title: "Fitness", icon: "activity", w: 320, h: 300 },
  memory: { title: "Memory Vault", icon: "brain", w: 340, h: 360 },
  chat: { title: "ARIA Chat", icon: "message", w: 360, h: 400 },
  explain: { title: "Explanation", icon: "sparkles", w: 340, h: 300 },
};

export const WORKSPACE_LAYOUT: PanelKind[] = [
  "news",
  "calendar",
  "weather",
  "rugby",
  "music",
  "tasks",
  "fitness",
  "memory",
];
