import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  Loader2,
  Play,
  Share2,
  Upload,
  Wand2,
  Copy,
  Check,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { getTool, type StudioTool, type ToolField } from "@/lib/aria/studio-tools";
import {
  getFavorites,
  toggleFavorite,
  pushRecent,
} from "@/lib/aria/studio-favorites";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/streamImage";
import { streamVideo, type VideoStreamEvent } from "@/lib/streamVideo";
import { JarvisOrb } from "@/components/aria/JarvisOrb";

export const Route = createFileRoute("/_authenticated/studio/$toolId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tool — ARIA Studio" }] }),
  component: ToolRunner,
});

type FormValues = Record<string, string>;
type ImageInput = { url: string; dataUrl?: string; name: string; file?: File };

function ToolRunner() {
  const { toolId } = useParams({ from: "/_authenticated/studio/$toolId" });
  const tool = useMemo(() => getTool(toolId), [toolId]);
  const [values, setValues] = useState<FormValues>({});
  const [imgInputs, setImgInputs] = useState<Record<string, ImageInput | null>>({});
  const [running, setRunning] = useState(false);
  const [textOut, setTextOut] = useState("");
  const [imgOut, setImgOut] = useState<string | null>(null);
  const [imgFinal, setImgFinal] = useState(false);
  const [videoOut, setVideoOut] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState("");
  const [audioOut, setAudioOut] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setFavs(getFavorites());
    // hydrate defaults
    if (!tool) return;
    const init: FormValues = {};
    for (const f of tool.fields) {
      if (f.kind === "select" && f.defaultValue) init[f.key] = f.defaultValue;
    }
    setValues(init);
    // autosave draft
    try {
      const raw = window.localStorage.getItem(`aria:studio:draft:${toolId}`);
      if (raw) setValues((v) => ({ ...v, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, [tool, toolId]);

  useEffect(() => {
    if (!toolId) return;
    try {
      window.localStorage.setItem(`aria:studio:draft:${toolId}`, JSON.stringify(values));
    } catch {
      /* ignore */
    }
  }, [values, toolId]);

  if (!tool) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Tool not found
          </p>
          <Link
            to="/studio"
            className="mt-3 inline-block rounded-md border border-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
          >
            Back to Studio
          </Link>
        </div>
      </div>
    );
  }

  const isFav = favs.includes(tool.id);

  async function uploadImage(f: File): Promise<ImageInput> {
    // Convert to data URL for edit endpoints; also upload to storage for video seed URL
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read fail"));
      r.readAsDataURL(f);
    });
    let signedUrl = "";
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (userId) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${userId}/studio/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("aria-uploads")
          .upload(path, f, { contentType: f.type });
        if (!error) {
          const { data } = await supabase.storage
            .from("aria-uploads")
            .createSignedUrl(path, 60 * 60 * 6);
          signedUrl = data?.signedUrl ?? "";
        }
      }
    } catch {
      /* fall back to data URL */
    }
    return { url: signedUrl || dataUrl, dataUrl, name: f.name, file: f };
  }

  async function onPickImage(key: string, f: File) {
    try {
      const img = await uploadImage(f);
      setImgInputs((s) => ({ ...s, [key]: img }));
      toast.success("Image ready");
    } catch {
      toast.error("Upload failed");
    }
  }

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (running || !tool) return;
    const t = tool;
    const prompt = (values.prompt ?? "").trim();

    // Basic validation
    if (t.runner === "stt") {
      const audio = imgInputs.audio;
      if (!audio?.file) return toast.error("Attach an audio file");
    } else if (t.runner === "image-edit") {
      if (!imgInputs.image) return toast.error("Attach an image");
    } else if (t.runner === "image-generate" || t.runner === "video-generate" || t.runner === "text" || t.runner === "tts") {
      if (!prompt) return toast.error("Enter a prompt");
    }

    setRunning(true);
    setTextOut("");
    setImgOut(null);
    setImgFinal(false);
    setVideoOut(null);
    setVideoStatus("");
    setAudioOut(null);
    setTranscript("");
    pushRecent(t.id);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    navigator.vibrate?.(10);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      if (t.runner === "image-generate") {
        const finalPrompt = t.textPreset
          ? `${t.textPreset}\n\nUser brief: ${prompt}`
          : prompt;
        await streamImage(
          "/api/generate-image",
          {
            prompt: finalPrompt,
            quality: (values.quality as "low" | "medium" | "high") ?? t.quality ?? "low",
            size: values.size ?? t.size ?? "1024x1024",
          },
          token,
          (url, isFinal) => {
            flushSync(() => {
              setImgOut(url);
              if (isFinal) setImgFinal(true);
            });
          },
          ac.signal,
        );
        toast.success("Image ready");
      } else if (t.runner === "image-edit") {
        const img = imgInputs.image;
        const finalPrompt = t.textPreset
          ? `${t.textPreset}${prompt ? `\n\nAdditional: ${prompt}` : ""}`
          : prompt;
        const dataUrl = img?.dataUrl ?? img?.url ?? "";
        const res = await fetch("/api/edit-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt: finalPrompt, imageDataUrl: dataUrl }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(await res.text());
        // Reuse SSE parser inline for edit
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const payload = l.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload) as {
                type?: string;
                b64_json?: string;
                data?: Array<{ b64_json?: string }>;
              };
              const b64 = evt.b64_json ?? evt.data?.[0]?.b64_json ?? null;
              if (b64) {
                flushSync(() => {
                  setImgOut(`data:image/png;base64,${b64}`);
                  if ((evt.type ?? "").includes("completed")) setImgFinal(true);
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
        setImgFinal(true);
        toast.success("Edit complete");
      } else if (t.runner === "video-generate") {
        const seed = imgInputs.image;
        await streamVideo(
          {
            prompt,
            imageUrl: seed?.url ?? null,
            duration: (values.duration as "5" | "10") ?? "5",
            aspectRatio: (values.aspectRatio as "16:9" | "9:16" | "1:1") ?? "16:9",
            mode: "cinematic",
          },
          token,
          (evt: VideoStreamEvent) => {
            if (evt.type === "status") {
              setVideoStatus(
                evt.status === "IN_QUEUE"
                  ? `Queued${evt.position !== undefined ? ` · #${evt.position}` : ""}`
                  : evt.status === "IN_PROGRESS"
                    ? "Generating frames…"
                    : evt.status,
              );
            } else if (evt.type === "final") {
              setVideoOut(evt.url);
              setVideoStatus("");
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          },
          ac.signal,
        );
        toast.success("Video ready");
      } else if (t.runner === "tts") {
        const res = await fetch("/api/tts/lovable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: prompt, voice: "alloy" }),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioOut(url);
        toast.success("Audio ready");
      } else if (t.runner === "stt") {
        const audio = imgInputs.audio?.file;
        if (!audio) throw new Error("No audio");
        const fd = new FormData();
        fd.append("file", audio, audio.name);
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        // stt route streams SSE deltas; parse text
        if (res.body) {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let full = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              try {
                const j = JSON.parse(l.slice(5).trim()) as { delta?: string; text?: string };
                if (j.delta) {
                  full += j.delta;
                  setTranscript(full);
                } else if (j.text) {
                  full = j.text;
                  setTranscript(full);
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
        toast.success("Transcript ready");
      } else if (tool.runner === "text") {
        const res = await fetch("/api/text-tool", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            toolId: tool.id,
            textPreset: tool.textPreset,
            prompt,
            input: values,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(await res.text());
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setTextOut(acc);
        }
        toast.success("Ready");
      }
      // clear draft after successful run
      try {
        window.localStorage.removeItem(`aria:studio:draft:${tool.id}`);
      } catch {
        /* ignore */
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    } finally {
      setRunning(false);
    }
  }

  function download(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  async function share(url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ url, title: tool.name });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(textOut || transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <Link to="/studio" className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 text-primary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="truncate font-display text-xs uppercase tracking-[0.3em] text-primary hud-text-glow">
            {tool.name}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{tool.tagline}</div>
        </div>
        <button
          onClick={() => setFavs(toggleFavorite(tool.id))}
          className={`grid h-8 w-8 place-items-center rounded-md border transition ${
            isFav ? "border-accent bg-accent/15 text-accent" : "border-primary/25 text-muted-foreground"
          }`}
          aria-label="Favourite"
        >
          <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* OUTPUT STAGE */}
          <OutputStage
            tool={tool}
            running={running}
            textOut={textOut}
            imgOut={imgOut}
            imgFinal={imgFinal}
            videoOut={videoOut}
            videoStatus={videoStatus}
            audioOut={audioOut}
            transcript={transcript}
            copied={copied}
            onCopy={copyText}
            onDownload={download}
            onShare={share}
          />

          {/* FORM */}
          <form onSubmit={run} className="space-y-3">
            {tool.templates && tool.templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tool.templates.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, prompt: t.value }))}
                    className="rounded-full border border-primary/25 bg-card/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary/80 hover:border-primary/60"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {tool.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ""}
                image={imgInputs[f.key] ?? null}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                onPickImage={(file) => onPickImage(f.key, file)}
                onClearImage={() => setImgInputs((s) => ({ ...s, [f.key]: null }))}
              />
            ))}

            <div className="flex gap-2 pb-8">
              <motion.button
                type="submit"
                disabled={running}
                whileTap={{ scale: 0.97 }}
                className="hud-corner flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/15 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-primary disabled:opacity-40"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Run
                  </>
                )}
              </motion.button>
              {running && (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setRunning(false);
                  }}
                  className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 font-display text-xs uppercase tracking-[0.3em] text-destructive"
                >
                  Stop
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function OutputStage(props: {
  tool: StudioTool;
  running: boolean;
  textOut: string;
  imgOut: string | null;
  imgFinal: boolean;
  videoOut: string | null;
  videoStatus: string;
  audioOut: string | null;
  transcript: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: (url: string, name: string) => void;
  onShare: (url: string) => void;
}) {
  const {
    tool,
    running,
    textOut,
    imgOut,
    imgFinal,
    videoOut,
    videoStatus,
    audioOut,
    transcript,
    copied,
    onCopy,
    onDownload,
    onShare,
  } = props;
  const hasText = textOut || transcript;
  const hasImg = imgOut;
  const hasVideo = videoOut;
  const hasAudio = audioOut;
  const empty = !hasText && !hasImg && !hasVideo && !hasAudio;

  return (
    <div className="hud-corner relative overflow-hidden rounded-2xl border border-primary/25 bg-card/40">
      {empty ? (
        <div className="grid aspect-video place-items-center px-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <JarvisOrb state={running ? "thinking" : "idle"} size={140} />
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/70">
              {running
                ? tool.runner === "video-generate"
                  ? videoStatus || "Synthesising video…"
                  : "Working…"
                : "Ready"}
            </p>
          </div>
        </div>
      ) : hasImg ? (
        <div className="relative">
          <motion.img
            key={imgOut}
            src={imgOut!}
            alt=""
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="w-full transition-[filter] duration-500"
            style={{ filter: imgFinal ? "blur(0px)" : "blur(20px)" }}
          />
          <StageActions
            onDownload={() => onDownload(imgOut!, `${tool.id}.png`)}
            onShare={() => onShare(imgOut!)}
          />
        </div>
      ) : hasVideo ? (
        <div className="relative">
          <video src={videoOut!} controls autoPlay loop playsInline className="w-full" />
          <StageActions
            onDownload={() => onDownload(videoOut!, `${tool.id}.mp4`)}
            onShare={() => onShare(videoOut!)}
          />
        </div>
      ) : hasAudio ? (
        <div className="grid place-items-center p-8">
          <audio src={audioOut!} controls autoPlay className="w-full max-w-md" />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onDownload(audioOut!, `${tool.id}.mp3`)}
              className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
            >
              <Download className="h-3 w-3" /> Save
            </button>
          </div>
        </div>
      ) : (
        <div className="relative max-h-[60vh] overflow-y-auto p-4">
          <article className="prose prose-invert prose-sm max-w-none prose-pre:my-2 prose-pre:bg-background/60 prose-headings:font-display">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {textOut || transcript}
            </ReactMarkdown>
          </article>
          <div className="sticky bottom-0 mt-3 flex gap-2 border-t border-primary/15 bg-card/80 pt-2 backdrop-blur">
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() =>
                onDownload(
                  URL.createObjectURL(new Blob([textOut || transcript], { type: "text/markdown" })),
                  `${tool.id}.md`,
                )
              }
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
            >
              <Download className="h-3 w-3" /> Save .md
            </button>
          </div>
        </div>
      )}
      {running && (
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
  );
}

function StageActions(props: { onDownload: () => void; onShare: () => void }) {
  return (
    <div className="absolute bottom-2 right-2 flex gap-1.5">
      <button
        onClick={props.onDownload}
        className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-background/70 text-primary backdrop-blur"
        aria-label="Download"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={props.onShare}
        className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-background/70 text-primary backdrop-blur"
        aria-label="Share"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FieldInput(props: {
  field: ToolField;
  value: string;
  image: ImageInput | null;
  onChange: (v: string) => void;
  onPickImage: (f: File) => void;
  onClearImage: () => void;
}) {
  const { field, value, image, onChange, onPickImage, onClearImage } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (field.kind === "prompt" || field.kind === "text") {
    return (
      <label className="block">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {field.label}
        </div>
        <div className="hud-corner rounded-xl border border-primary/25 bg-card/60">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={field.kind === "prompt" ? field.rows ?? 3 : 1}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {field.label}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                value === o.value
                  ? "border-primary bg-primary/15 text-primary hud-text-glow"
                  : "border-border bg-card/60 text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // image / file
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {field.label}
        </div>
        {field.hint && (
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
            {field.hint}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={field.key === "audio" ? "audio/*,video/*" : "image/*"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickImage(f);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="hud-corner flex items-center gap-3 rounded-xl border border-primary/40 bg-card/60 p-2">
          {field.key === "audio" ? (
            <div className="grid h-14 w-14 place-items-center rounded-md bg-primary/10 text-primary">
              <Play className="h-5 w-5" />
            </div>
          ) : (
            <img src={image.dataUrl ?? image.url} alt="" className="h-14 w-14 rounded-md object-cover" />
          )}
          <div className="flex-1 truncate font-mono text-[11px] text-foreground">{image.name}</div>
          <button
            type="button"
            onClick={onClearImage}
            className="rounded-md border border-destructive/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-destructive"
          >
            Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onPickImage(f);
          }}
          className={`hud-corner flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 font-mono text-[10px] uppercase tracking-widest transition ${
            dragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-primary/25 bg-card/40 text-muted-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          {dragOver ? "Drop here" : "Click or drop file"}
        </button>
      )}
    </div>
  );
}
