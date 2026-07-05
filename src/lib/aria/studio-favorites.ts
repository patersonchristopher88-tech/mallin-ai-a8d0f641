// Local-storage backed favorites + recents for Studio tools.
const FAV_KEY = "aria:studio:favorites";
const RECENT_KEY = "aria:studio:recents";
const RECENT_MAX = 12;

function safeRead(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getFavorites(): string[] {
  return safeRead(FAV_KEY);
}
export function toggleFavorite(id: string): string[] {
  const set = new Set(safeRead(FAV_KEY));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = [...set];
  safeWrite(FAV_KEY, next);
  return next;
}
export function getRecents(): string[] {
  return safeRead(RECENT_KEY);
}
export function pushRecent(id: string): string[] {
  const cur = safeRead(RECENT_KEY).filter((x) => x !== id);
  cur.unshift(id);
  const next = cur.slice(0, RECENT_MAX);
  safeWrite(RECENT_KEY, next);
  return next;
}
