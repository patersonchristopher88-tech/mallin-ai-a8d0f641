import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile } from "@/lib/aria/profile.functions";
import { PERSONAS, type PersonaKey } from "@/lib/aria/personas";
import { THEME_PRESETS } from "@/lib/aria/themes";
import { useTheme } from "@/components/aria/ThemeProvider";
import { useEffect, useState } from "react";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — ARIA" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);
  const { setTheme } = useTheme();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [tab, setTab] = useState<"assistant" | "appearance" | "voice" | "account">("assistant");
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (profile.data) setDraft({});
  }, [profile.data]);

  const merged = { ...profile.data, ...draft } as Record<string, unknown>;

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateFn({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setDraft({});
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function update(patch: Record<string, unknown>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function applyThemePreset(presetKey: string) {
    const p = THEME_PRESETS.find((t) => t.key === presetKey);
    if (!p) return;
    const theme = {
      preset: p.key,
      background: p.background,
      primary: p.primary,
      accent: p.accent,
      alert: p.alert,
      glow: p.glow,
      scanline: p.scanline,
      grid: p.grid,
      radius: p.radius,
    };
    update({ theme });
    setTheme({
      background: p.background,
      primary: p.primary,
      accent: p.accent,
      alert: p.alert,
      glow: p.glow,
      scanline: p.scanline,
      grid: p.grid,
      radius: p.radius,
    });
  }

  if (profile.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center font-mono text-xs uppercase tracking-widest text-primary/70">
        Loading…
      </div>
    );
  }

  const TABS: Array<{ key: typeof tab; label: string }> = [
    { key: "assistant", label: "Assistant" },
    { key: "appearance", label: "Appearance" },
    { key: "voice", label: "Voice" },
    { key: "account", label: "Account" },
  ];

  return (
    <main className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
      <Link
        to="/chat"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Back to ARIA
      </Link>

      <div className="mt-6 mb-8 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-widest text-primary hud-text-glow">
            System Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tune your assistant, the HUD, the voice, and your account.
          </p>
        </div>
        <div className="hidden md:block">
          <JarvisOrb state="idle" size={120} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`hud-corner rounded border px-4 py-1.5 font-display text-xs uppercase tracking-widest transition ${
              tab === t.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-foreground/70 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="hud-panel hud-corner rounded-lg p-6">
        {tab === "assistant" && (
          <div className="space-y-6">
            <Field label="Assistant name">
              <input
                type="text"
                value={(merged.assistant_name as string) ?? "ARIA"}
                onChange={(e) => update({ assistant_name: e.target.value })}
                className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              />
            </Field>

            <Field label="Persona">
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => {
                  const p = PERSONAS[k];
                  const active = (merged.persona as string) === k;
                  return (
                    <button
                      key={k}
                      onClick={() => update({ persona: k })}
                      className={`hud-corner rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="font-display text-sm uppercase tracking-widest text-primary">
                        {p.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{p.tagline}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {(merged.persona as string) === "custom" && (
              <Field label="Custom system prompt">
                <textarea
                  rows={5}
                  value={(merged.system_prompt as string) ?? ""}
                  onChange={(e) => update({ system_prompt: e.target.value })}
                  className="w-full rounded border border-primary/30 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="You are..."
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Verbosity · ${merged.verbosity ?? 50}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={(merged.verbosity as number) ?? 50}
                  onChange={(e) => update({ verbosity: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </Field>
              <Field label={`Formality · ${merged.formality ?? 50}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={(merged.formality as number) ?? 50}
                  onChange={(e) => update({ formality: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </Field>
            </div>

            <Field label="Default model">
              <select
                value={(merged.default_chat_model as string) ?? "google/gemini-3-flash-preview"}
                onChange={(e) => update({ default_chat_model: e.target.value })}
                className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              >
                <option value="google/gemini-3-flash-preview">Gemini 3 Flash · fast (default)</option>
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro · powerful</option>
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash · balanced</option>
                <option value="openai/gpt-5">GPT-5 · strongest</option>
                <option value="openai/gpt-5-mini">GPT-5 mini · cheap</option>
                <option value="openai/gpt-5.5">GPT-5.5 · top reasoning</option>
              </select>
            </Field>
          </div>
        )}

        {tab === "appearance" && (
          <div className="space-y-6">
            <Field label="Theme presets">
              <div className="grid gap-3 sm:grid-cols-3">
                {THEME_PRESETS.map((p) => {
                  const active = ((merged.theme as { preset?: string })?.preset ?? "stark") === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => applyThemePreset(p.key)}
                      className={`hud-corner rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="mb-2 flex gap-1">
                        <span
                          className="h-6 w-6 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: p.background }}
                        />
                        <span
                          className="h-6 w-6 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: p.primary }}
                        />
                        <span
                          className="h-6 w-6 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: p.accent }}
                        />
                        <span
                          className="h-6 w-6 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: p.alert }}
                        />
                      </div>
                      <div className="font-display text-xs uppercase tracking-widest text-primary">
                        {p.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Coming next system tick">
              <p className="text-sm text-muted-foreground">
                Full custom theme builder (color pickers, glow, scanlines, mood color editor) and Gideon
                avatar arrive in the next update.
              </p>
            </Field>
          </div>
        )}

        {tab === "voice" && (
          <div className="space-y-6">
            <Field label="Voice provider">
              <div className="text-sm text-muted-foreground">
                Voice in/out, ElevenLabs character presets, and voice cloning arrive in the next update.
                Defaults are pre-configured so it works the moment voice ships.
              </div>
            </Field>
            <Field label="Default voice">
              <select
                value={(merged.voice_id as string) ?? "alloy"}
                onChange={(e) => update({ voice_id: e.target.value })}
                className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              >
                {["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        )}

        {tab === "account" && (
          <div className="space-y-4">
            <Field label="Email">
              <div className="font-mono text-sm text-foreground/80">
                {(merged.email as string) ?? "—"}
              </div>
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={(merged.display_name as string) ?? ""}
                onChange={(e) => update({ display_name: e.target.value })}
                className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-lg border border-primary/30 bg-card/80 px-4 py-3 backdrop-blur">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {Object.keys(draft).length === 0 ? "No changes" : `${Object.keys(draft).length} pending change(s)`}
        </div>
        <button
          onClick={() => save.mutate(draft)}
          disabled={Object.keys(draft).length === 0 || save.isPending}
          className="hud-corner rounded border border-primary bg-primary/15 px-5 py-2 font-display text-xs uppercase tracking-widest text-primary transition hover:bg-primary/25 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-primary/70">
        {label}
      </label>
      {children}
    </div>
  );
}
