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
import { ArrowLeft, Play, Brain, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ELEVENLABS_VOICES } from "@/lib/aria/elevenlabs-voices";
import { listMemories, deleteMemory } from "@/lib/aria/memories.functions";
import { useQuery as useReactQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — ARIA" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);
  const listMemoriesFn = useServerFn(listMemories);
  const deleteMemoryFn = useServerFn(deleteMemory);
  const { setTheme } = useTheme();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const memories = useReactQuery({ queryKey: ["memories"], queryFn: () => listMemoriesFn() });

  const [tab, setTab] = useState<"assistant" | "appearance" | "voice" | "memory" | "account">("assistant");
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

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => deleteMemoryFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove memory"),
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
    { key: "memory", label: "Memory" },
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
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      k: "lovable",
                      title: "Lovable AI (default)",
                      sub: "OpenAI voices via gateway. Included with your credits.",
                    },
                    {
                      k: "elevenlabs",
                      title: "ElevenLabs",
                      sub: "Cinematic, character voices. Uses your ElevenLabs connector.",
                    },
                  ] as const
                ).map((p) => {
                  const active = ((merged.voice_provider as string) ?? "lovable") === p.k;
                  return (
                    <button
                      key={p.k}
                      onClick={() => update({ voice_provider: p.k })}
                      className={`hud-corner rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="font-display text-sm uppercase tracking-widest text-primary">
                        {p.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{p.sub}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {((merged.voice_provider as string) ?? "lovable") === "lovable" ? (
              <Field label="Lovable AI voice">
                <select
                  value={(merged.voice_id as string) ?? "alloy"}
                  onChange={(e) => update({ voice_id: e.target.value })}
                  className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                >
                  {[
                    "alloy",
                    "ash",
                    "ballad",
                    "coral",
                    "echo",
                    "sage",
                    "shimmer",
                    "verse",
                    "marin",
                    "cedar",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <ElevenLabsPicker
                voiceId={(merged.elevenlabs_voice_id as string) ?? ""}
                model={(merged.elevenlabs_model as string) ?? "eleven_turbo_v2_5"}
                onVoice={(v) => update({ elevenlabs_voice_id: v })}
                onModel={(m) => update({ elevenlabs_model: m })}
              />
            )}

            <WakeWordAndHotkeyPanel />
          </div>
        )}

        {tab === "memory" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-primary/25 bg-card/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-sm uppercase tracking-widest text-primary">Memory settings</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ARIA can remember preferences, goals, and personal context with your permission.
                  </p>
                </div>
                <button
                  onClick={() => update({ memory_enabled: !((merged.memory_enabled as boolean | undefined) ?? true) })}
                  className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                    (merged.memory_enabled as boolean | undefined) ?? true
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {(merged.memory_enabled as boolean | undefined) ?? true ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-primary/25 bg-card/40 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Brain className="h-4 w-4" />
                <div className="font-display text-sm uppercase tracking-widest">Stored memories</div>
              </div>
              <div className="mt-3 space-y-2">
                {(memories.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-primary/20 p-4 text-sm text-muted-foreground">
                    No memories saved yet. ARIA will suggest durable facts to remember when you opt in.
                  </div>
                ) : (
                  (memories.data ?? []).map((memory: { id: string; content: string; kind?: string }) => (
                    <div key={memory.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/15 bg-background/50 p-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">{memory.kind ?? "fact"}</div>
                        <div className="mt-1 text-sm text-foreground">{memory.content}</div>
                      </div>
                      <button
                        onClick={() => deleteMemoryMutation.mutate(memory.id)}
                        className="rounded-full border border-destructive/30 bg-destructive/10 p-2 text-destructive"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
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

function ElevenLabsPicker({
  voiceId,
  model,
  onVoice,
  onModel,
}: {
  voiceId: string;
  model: string;
  onVoice: (v: string) => void;
  onModel: (m: string) => void;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  async function preview(id: string) {
    setPreviewing(id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/tts/elevenlabs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: "Systems online. This is how I sound.",
          voiceId: id,
          modelId: model,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewing(null);
      };
      await a.play();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
      setPreviewing(null);
    }
  }
  return (
    <div className="space-y-4">
      <Field label="ElevenLabs model">
        <select
          value={model}
          onChange={(e) => onModel(e.target.value)}
          className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
        >
          <option value="eleven_turbo_v2_5">Turbo v2.5 · fastest</option>
          <option value="eleven_multilingual_v2">Multilingual v2 · highest quality</option>
          <option value="eleven_turbo_v2">Turbo v2 · balanced</option>
        </select>
      </Field>
      <Field label="ElevenLabs voice">
        <div className="grid gap-2 sm:grid-cols-2">
          {ELEVENLABS_VOICES.map((v) => {
            const active = voiceId === v.id;
            return (
              <div
                key={v.id}
                className={`hud-corner flex items-center justify-between gap-2 rounded-lg border p-3 transition ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <button onClick={() => onVoice(v.id)} className="min-w-0 flex-1 text-left">
                  <div className="font-display text-xs uppercase tracking-widest text-primary">
                    {v.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {v.description}
                  </div>
                </button>
                <button
                  onClick={() => preview(v.id)}
                  disabled={previewing === v.id}
                  aria-label="Preview"
                  className="grid h-8 w-8 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </Field>
    </div>
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

function WakeWordAndHotkeyPanel() {
  const [enabled, setEnabled] = useState(
    typeof window !== "undefined" && localStorage.getItem("aria.wakeWordEnabled") === "1",
  );
  const [phrase, setPhrase] = useState(
    (typeof window !== "undefined" && localStorage.getItem("aria.wakeWordPhrase")) || "hey aria",
  );
  const [hotkey, setHotkey] = useState(
    (typeof window !== "undefined" && localStorage.getItem("aria.hotkey")) || "mod+shift+a",
  );
  const [hotkeyTarget, setHotkeyTarget] = useState(
    (typeof window !== "undefined" && localStorage.getItem("aria.hotkeyTarget")) || "/chat",
  );

  function commit(patch: Partial<{ enabled: boolean; phrase: string; hotkey: string; target: string }>) {
    if (patch.enabled !== undefined) {
      localStorage.setItem("aria.wakeWordEnabled", patch.enabled ? "1" : "0");
      setEnabled(patch.enabled);
    }
    if (patch.phrase !== undefined) {
      localStorage.setItem("aria.wakeWordPhrase", patch.phrase);
      setPhrase(patch.phrase);
    }
    if (patch.hotkey !== undefined) {
      localStorage.setItem("aria.hotkey", patch.hotkey);
      setHotkey(patch.hotkey);
    }
    if (patch.target !== undefined) {
      localStorage.setItem("aria.hotkeyTarget", patch.target);
      setHotkeyTarget(patch.target);
    }
    window.dispatchEvent(new Event("aria:prefs"));
  }

  function captureHotkey(e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push("mod");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    const k = e.key.toLowerCase();
    if (!["control", "meta", "shift", "alt"].includes(k)) parts.push(k);
    if (parts.length >= 2) commit({ hotkey: parts.join("+") });
  }

  return (
    <div className="space-y-6 rounded-lg border border-primary/25 bg-card/40 p-4">
      <div>
        <h3 className="font-display text-sm uppercase tracking-widest text-primary hud-text-glow">
          Wake word
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Chromium-based browsers only. Uses the Web Speech API — mic must stay allowed.
        </p>
      </div>
      <Field label="Enabled">
        <button
          onClick={() => commit({ enabled: !enabled })}
          className={`hud-corner rounded border px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition ${
            enabled
              ? "border-primary bg-primary/20 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          {enabled ? "Listening" : "Off"}
        </button>
      </Field>
      <Field label="Wake phrase">
        <input
          value={phrase}
          onChange={(e) => commit({ phrase: e.target.value.toLowerCase() })}
          className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </Field>

      <div className="pt-2">
        <h3 className="font-display text-sm uppercase tracking-widest text-primary hud-text-glow">
          Global hotkey
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Press a combo below to capture. Default: Cmd/Ctrl+Shift+A.
        </p>
      </div>
      <Field label="Combo">
        <input
          value={hotkey}
          onKeyDown={captureHotkey}
          readOnly
          className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </Field>
      <Field label="Open">
        <select
          value={hotkeyTarget}
          onChange={(e) => commit({ target: e.target.value })}
          className="w-full max-w-sm rounded border border-primary/30 bg-background/60 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
        >
          <option value="/chat">Chat</option>
          <option value="/vision">Live Vision</option>
          <option value="/ar">AR Mode</option>
          <option value="/studio">Studio</option>
        </select>
      </Field>
    </div>
  );
}
