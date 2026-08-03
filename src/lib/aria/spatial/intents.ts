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
  { kind: "model", re: /\b(?:3d model|model|hologram|show me the)\s+(?:of\s+)?(?:a\s+|an\s+|the\s+)?(.+)/, capture: true },
  { kind: "image", re: /\b(?:generate|create|make|draw)\s+(?:me\s+)?(?:an?\s+)?image\s+(?:of\s+)?(.+)/, capture: true },
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

const MODEL_HINTS =
  /\b(earth|moon|mars|saturn|solar system|heart|engine|v8|rocket|aircraft|plane|jet|computer|motherboard|atom|scrum|building|skyscraper|human body|lungs|brain|skeleton)\b/;

/** Fast, offline intent parser. Returns "unknown" when nothing matches. */
export function parseIntent(input: string): SpatialIntent {
  const raw = input.trim();
  const text = raw.toLowerCase().replace(/^(hey |ok |aria[, ]*)+/g, "");

  // A direct model noun beats generic "show me" phrasing.
  if (/\b(show|display|open|bring up|pull up|render|build|generate)\b/.test(text)) {
    const m = text.match(MODEL_HINTS);
    if (m && !/\bnews\b/.test(text)) return { kind: "model", query: m[1], raw };
  }

  for (const r of RULES) {
    const m = text.match(r.re);
    if (!m) continue;
    if (r.capture) {
      const q = (m[1] ?? "").replace(/[.?!]+$/, "").trim();
      if (!q) continue;
      return { kind: r.kind, query: q, raw };
    }
    return { kind: r.kind, raw };
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
