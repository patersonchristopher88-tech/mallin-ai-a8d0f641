import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Wand2,
  Loader2,
  Download,
  Trash2,
  Image as ImageIcon,
  Film,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { streamImage } from "@/lib/streamImage";
import { streamVideo, type VideoStreamEvent } from "@/lib/streamVideo";
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

type Mode = "image" | "video";

const IMG_QUALITY: Array<{ value: "low" | "medium" | "high"; label: string }> = [
  { value: "low", label: "Fast" },
  { value: "medium", label: "Standard" },
  { value: "high", label: "Hi-Res" },
];
const IMG_SIZES = ["1024x1024", "1024x1536", "1536x1024"];

const VID_DURATION: Array<{ value: "5" | "10"; label: string }> = [
  { value: "5", label: "5s" },
  { value: "10", label: "10s" },
];
const VID_RATIO: Array<"16:9" | "9:16" | "1:1"> = ["16:9", "9:16", "1:1"];
const VID_MODE: Array<{ value: "fast" | "cinematic"; label: string }> = [
  { value: "fast", label: "Fast" },
  { value: "cinematic", label: "Cinematic" },
];

function StudioPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGenerations);
  const delFn = useServerFn(deleteGeneration);

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  // image controls
  const [quality, setQuality] = useState<"low" | "medium" | "high">("low");
  const [size, setSize] = useState("1024x1024");
  // video controls
  const [duration, setDuration] = useState<"5" | "10">("5");
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [videoMode, setVideoMode] = useState<"fast" | "cinematic">("cinematic");
  const [seedImage, setSeedImage] = useState<{ url: string; name: string } | null>(null);
  const seedInputRef = useRef<HTMLInputElement | null>(null);

  // streaming state
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>("");
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
    setImgPreview(null);
    setVideoUrl(null);
    setVideoStatus("");
    setIsFinal(false);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    navigator.vibrate?.(10);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (mode === "image") {
        await streamImage(
          "/api/generate-image",
          { prompt: p, quality, size },
          token,
          (url, final) => {
            flushSync(() => {
              setImgPreview(url);
              if (final) setIsFinal(true);
            });
          },
          ac.signal,
        );
        toast.success("Image ready");
      } else {
        await streamVideo(
          {
            prompt: p,
            imageUrl: seedImage?.url ?? null,
            duration,
            aspectRatio: ratio,
            mode: videoMode,
          },
          token,
          (evt: VideoStreamEvent) => {
            if (evt.type === "status") {
              setVideoStatus(
                evt.status === "IN_QUEUE"
                  ? `Queued${evt.position !== undefined ? ` · #${evt.position}` : ""}`
                  : evt.status === "IN_PROGRESS"
                    ? "Generating frames…"
                    : evt.status === "saving"
                      ? "Saving…"
                      : evt.status,
              );
            } else if (evt.type === "final") {
              setVideoUrl(evt.url);
              setVideoStatus("");
              setIsFinal(true);
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          },
          ac.signal,
        );
        toast.success("Video ready");
      }
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

  async function pickSeed(file: File) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/seeds/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("aria-uploads")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("aria-uploads")
        .createSignedUrl(path, 60 * 60 * 6);
      if (!signed?.signedUrl) throw new Error("Sign failed");
      setSeedImage({ url: signed.signedUrl, name: file.name });
      toast.success("Starting frame ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
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
        <div className="flex rounded-lg border border-primary/25 bg-card/60 p-0.5">
          {(["image", "video"] as Mode[]).map((m) => {
            const Icon = m === "image" ? ImageIcon : Film;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                  mode === m ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {mode === m && (
                  <motion.span layoutId="studio-mode" className="absolute inset-0 rounded-md bg-primary" />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  {m}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Stage */}
          <div
            className={`hud-corner relative grid w-full place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-card/40 ${
              mode === "video" && ratio === "9:16" ? "aspect-[9/16] max-h-[60vh]" : "aspect-square"
            }`}
          >
            <AnimatePresence mode="wait">
              {mode === "image" && imgPreview ? (
                <motion.img
                  key={imgPreview.slice(-32)}
                  src={imgPreview}
                  alt={prompt}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className="h-full w-full object-cover transition-[filter] duration-500"
                  style={{ filter: isFinal ? "blur(0px)" : "blur(24px)" }}
                />
              ) : mode === "video" && videoUrl ? (
                <motion.video
                  key={videoUrl.slice(-32)}
                  src={videoUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full w-full object-cover"
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
                    {isStreaming
                      ? mode === "video"
                        ? videoStatus || "Synthesizing…"
                        : "Synthesizing…"
                      : `Ready to materialize ${mode}`}
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
            {mode === "video" && seedImage && !videoUrl && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border border-primary/30 bg-background/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-primary">
                <ImageIcon className="h-3 w-3" /> seed frame
              </div>
            )}
          </div>

          {/* Controls */}
          <form onSubmit={generate} className="space-y-3">
            <div className="hud-corner relative rounded-xl border border-primary/30 bg-card/60">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "image"
                    ? "Describe an image… e.g. 'Iron Man suit hovering over Tokyo at dusk, cinematic'"
                    : "Describe motion… e.g. 'slow dolly-in on the suit as energy ripples across the chest reactor'"
                }
                rows={3}
                className="block w-full resize-none bg-transparent px-3 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>

            {mode === "image" ? (
              <div className="flex flex-wrap gap-2">
                {IMG_QUALITY.map((q) => (
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
                {IMG_SIZES.map((s) => (
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
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {VID_MODE.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setVideoMode(m.value)}
                      className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                        videoMode === m.value
                          ? "border-primary bg-primary/15 text-primary hud-text-glow"
                          : "border-border bg-card/60 text-muted-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                  <div className="ml-auto" />
                  {VID_DURATION.map((d) => (
                    <button
                      type="button"
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                        duration === d.value
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border bg-card/60 text-muted-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {VID_RATIO.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                        ratio === r
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border bg-card/60 text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  <div className="ml-auto" />
                  <input
                    ref={seedInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void pickSeed(f);
                      e.target.value = "";
                    }}
                  />
                  {seedImage ? (
                    <button
                      type="button"
                      onClick={() => setSeedImage(null)}
                      className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent"
                    >
                      <X className="h-3 w-3" />
                      Clear seed
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => seedInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-card/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
                    >
                      <Upload className="h-3 w-3" />
                      Seed image
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {isStreaming ? (
                <motion.button
                  type="button"
                  onClick={cancel}
                  whileTap={{ scale: 0.96 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-destructive"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "video" ? videoStatus || "Generating…" : "Cancel"}
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={!prompt.trim()}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/15 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-primary disabled:opacity-40 animate-hud-breathe"
                >
                  {mode === "video" ? <Film className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                  Generate {mode}
                </motion.button>
              )}
            </div>
            {mode === "video" && (
              <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {videoMode === "cinematic"
                  ? "Kling 2.5 Turbo · ~2-4 min"
                  : "LTX 13B Distilled · ~30-60 sec"}
              </p>
            )}
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
  const isVideo = g.kind === "video";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud-corner group relative overflow-hidden rounded-xl border border-primary/25 bg-card/60"
    >
      {isVideo ? (
        <video
          src={g.url}
          className="aspect-square w-full object-cover"
          muted
          loop
          playsInline
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
        />
      ) : (
        <img src={g.url} alt={g.prompt} className="aspect-square w-full object-cover" />
      )}
      {isVideo && (
        <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md border border-accent/40 bg-background/80 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-accent">
          <Film className="h-2.5 w-2.5" /> Video
        </div>
      )}
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
