export interface ThemePreset {
  key: string;
  name: string;
  background: string;
  primary: string;
  accent: string;
  alert: string;
  glow: number; // 0-100
  scanline: boolean;
  grid: boolean;
  radius: number; // px
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "stark",
    name: "Stark HUD",
    background: "#02060f",
    primary: "#22e1ff",
    accent: "#ffb547",
    alert: "#ff3b3b",
    glow: 80,
    scanline: true,
    grid: true,
    radius: 12,
  },
  {
    key: "gideon",
    name: "Gideon Red",
    background: "#0a0204",
    primary: "#ff3b6b",
    accent: "#ffe0e6",
    alert: "#ffb547",
    glow: 70,
    scanline: true,
    grid: false,
    radius: 8,
  },
  {
    key: "friday",
    name: "Friday Rose",
    background: "#0c0814",
    primary: "#ff8ad1",
    accent: "#b070ff",
    alert: "#ff5555",
    glow: 65,
    scanline: false,
    grid: true,
    radius: 16,
  },
  {
    key: "karen",
    name: "Karen Amber",
    background: "#08070a",
    primary: "#ffb547",
    accent: "#fff1c2",
    alert: "#ff3b3b",
    glow: 55,
    scanline: false,
    grid: false,
    radius: 6,
  },
  {
    key: "mono",
    name: "Minimal Mono",
    background: "#0a0a0a",
    primary: "#e6e6e6",
    accent: "#9a9a9a",
    alert: "#ff5555",
    glow: 30,
    scanline: false,
    grid: false,
    radius: 14,
  },
];

// Convert "#RRGGBB" -> "H S% L%" (string suitable for CSS var that uses hsl())
export function hexToHslChannels(hex: string): string {
  const clean = hex.replace("#", "");
  const num = parseInt(
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean,
    16,
  );
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const MOOD_LABELS = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "alert",
  "happy",
  "serious",
  "playful",
  "concerned",
] as const;

export type MoodLabel = (typeof MOOD_LABELS)[number];

export const DEFAULT_MOOD_COLORS: Record<MoodLabel, string> = {
  idle: "#22e1ff",
  listening: "#aef9ff",
  thinking: "#b070ff",
  speaking: "#ffb547",
  alert: "#ff3b3b",
  happy: "#ffc870",
  serious: "#3a7bff",
  playful: "#ff7fbf",
  concerned: "#ff8a3a",
};
