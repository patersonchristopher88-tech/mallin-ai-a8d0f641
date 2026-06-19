import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_MOOD_COLORS, hexToHslChannels, type MoodLabel } from "@/lib/aria/themes";

interface ThemeShape {
  background: string;
  primary: string;
  accent: string;
  alert: string;
  glow: number;
  scanline: boolean;
  grid: boolean;
  radius: number;
}

const DEFAULT_THEME: ThemeShape = {
  background: "#02060f",
  primary: "#22e1ff",
  accent: "#ffb547",
  alert: "#ff3b3b",
  glow: 80,
  scanline: true,
  grid: true,
  radius: 12,
};

interface ThemeContextValue {
  theme: ThemeShape;
  setTheme: (t: Partial<ThemeShape>) => void;
  moodColors: Record<MoodLabel, string>;
  setMoodColors: (m: Partial<Record<MoodLabel, string>>) => void;
  mood: MoodLabel;
  setMood: (m: MoodLabel) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeShape>(DEFAULT_THEME);
  const [moodColors, setMoodColorsState] = useState<Record<MoodLabel, string>>(DEFAULT_MOOD_COLORS);
  const [mood, setMood] = useState<MoodLabel>("idle");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--background", hexToHslChannels(theme.background));
    root.style.setProperty("--primary", hexToHslChannels(theme.primary));
    root.style.setProperty("--accent", hexToHslChannels(theme.accent));
    root.style.setProperty("--destructive", hexToHslChannels(theme.alert));
    root.style.setProperty("--hud", hexToHslChannels(theme.primary));
    root.style.setProperty("--hud-gold", hexToHslChannels(theme.accent));
    root.style.setProperty("--hud-alert", hexToHslChannels(theme.alert));
    root.style.setProperty("--ring", hexToHslChannels(theme.primary));
    root.style.setProperty("--radius", `${theme.radius / 16}rem`);
    root.style.setProperty("--glow-strength", String(theme.glow / 100));
  }, [theme]);

  useEffect(() => {
    const hex = moodColors[mood] ?? moodColors.idle;
    document.documentElement.style.setProperty("--mood", hexToHslChannels(hex));
  }, [mood, moodColors]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (t) => setThemeState((prev) => ({ ...prev, ...t })),
      moodColors,
      setMoodColors: (m) => setMoodColorsState((prev) => ({ ...prev, ...m })),
      mood,
      setMood,
    }),
    [theme, moodColors, mood],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
