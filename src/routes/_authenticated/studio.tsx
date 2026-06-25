import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Wand2, Loader2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { streamImage } from "@/lib/streamImage";
import { supabase } from "@/integrations/supabase/client";
import {
  listGenerations,
  deleteGeneration,
  type GenerationRow,
} from "@/lib/aria/media.functions";
import { JarvisOrb } from "@/components/aria/JarvisOrb";

export const Route = createFileRoute("/_authenticated/studio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Studio — ARIA" }] }),
  component: StudioPage,
});

const QUALITY: Array<{ value: "low" | "medium" | "high"; label: string }> = [
  { value: "low", label: "Fast" },
  { value: "medium", label: "Standard" },
  { value: "high", label: "Hi-Res" },
];

const SIZES = ["1024x1024", "1024x1536", "1536x1024"];

function StudioPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGenerations);
  const delFn = useServerFn(deleteGeneration);

  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("low");
  const [size, setSize] = useState("1024x1024");
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const gens = useQuery({
    queryKey: ["generations"],
    queryFn: () => listFn(),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations"] }),
  });

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    const p = prompt.trim();
    if (!p || isStreaming) return;
    setIsStreaming(true);
    setPreview(null);
    setIsFinal(false);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    navigator.vibrate?.(10);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      await streamImage(
        "/api/generate-image",
        { prompt: p, quality, size },
        token,
        (url, final) => {
          flushSync(() => {
            setPreview(url);
            if (final) setIsFinal(true);
          });
        },
        ac.signal,
      );
      toast.success("Image ready");
      qc.invalidateQueries({ queryKey: ["generations"] });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      setIsStreaming(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <div className="font-display text-xs uppercase tracking-[0.3em] text-primary hud-text-glow">
            Studio
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          gpt-image-2
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Stage */}
          <div className="hud-corner relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-card/40">
            <AnimatePresence mode="wait">
              {preview ? (
                <motion.img
                  key={preview.slice(-32)}
                  src={preview}
                  alt={prompt}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className="h-full w-full object-cover transition-[filter] duration-500"
                  style={{ filter: isFinal ? "blur(0px)" : "blur(24px)" }}
                />
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 px-8 text-center"
                >
                  <JarvisOrb state={isStreaming ? "thinking" : "idle"} size={180} />
                  <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/70">
                    {isStreaming ? "Synthesizing…" : "Ready to materialize"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {isStreaming && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                <motion.div
                  className="h-full w-1/3 bg-primary"
                  style={{ boxShadow: "0 0 12px hsl(var(--primary))" }}
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <form onSubmit={generate} className="space-y-3">
            <div className="hud-corner relative rounded-xl border border-primary/30 bg-card/60">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe an image… e.g. 'Iron Man suit hovering over Tokyo at dusk, cinematic'"
                rows={3}
                className="block w-full resize-none bg-transparent px-3 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {QUALITY.map((q) => (
                <button
                  type="button"
                  key={q.value}
                  onClick={() => setQuality(q.value)}
                  className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                    quality === q.value
                      ? "border-primary bg-primary/15 text-primary hud-text-glow"
                      : "border-border bg-card/60 text-muted-foreground"
                  }`}
                >
                  {q.label}
                </button>
              ))}
              <div className="ml-auto" />
              {SIZES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSize(s)}
                  className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                    size === s
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-card/60 text-muted-foreground"
                  }`}
                >
                  {s.replace("x", "·")}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {isStreaming ? (
                <motion.button
                  type="button"
                  onClick={cancel}
                  whileTap={{ scale: 0.96 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-destructive"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancel
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={!prompt.trim()}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/15 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-primary disabled:opacity-40 animate-hud-breathe"
                >
                  <Wand2 className="h-4 w-4" />
                  Generate
                </motion.button>
              )}
            </div>
          </form>

          {/* History */}
          <section className="pt-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[11px] uppercase tracking-[0.35em] text-primary/80">
                /// Recent
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground">
                {gens.data?.length ?? 0}
              </span>
            </div>
            {gens.isLoading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (gens.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Your generations will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {gens.data!.map((g) => (
                  <GenCard key={g.id} g={g} onDelete={() => del.mutate(g.id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function GenCard({ g, onDelete }: { g: GenerationRow; onDelete: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud-corner group relative overflow-hidden rounded-xl border border-primary/25 bg-card/60"
    >
      <img src={g.url} alt={g.prompt} className="aspect-square w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-2">
        <p className="line-clamp-2 text-[10px] text-foreground/90">{g.prompt}</p>
        <div className="flex shrink-0 gap-1">
          <a
            href={g.url}
            download
            className="grid h-7 w-7 place-items-center rounded-md border border-primary/30 bg-background/60 text-primary"
          >
            <Download className="h-3 w-3" />
          </a>
          <button
            onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-md border border-destructive/30 bg-background/60 text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
