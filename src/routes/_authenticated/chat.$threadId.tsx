import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThreadMessages } from "@/lib/aria/threads.functions";
import { getProfile } from "@/lib/aria/profile.functions";
import { JarvisOrb, type OrbState } from "@/components/aria/JarvisOrb";
import { ThreadDrawer } from "@/components/aria/ThreadDrawer";
import { VoiceMic } from "@/components/aria/VoiceMic";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Square, Menu, Volume2, VolumeX, Paperclip, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "@/components/aria/ThemeProvider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn as _useServerFn2 } from "@tanstack/react-start";
import { recordUpload } from "@/lib/aria/media.functions";
import { SpotifyHud } from "@/components/aria/SpotifyHud";
import { useDropzone } from "react-dropzone";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  component: ThreadView,
});

function ThreadView() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const getMessagesFn = useServerFn(getThreadMessages);
  const profileFn = useServerFn(getProfile);
  const { setMood } = useTheme();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const initial = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => getMessagesFn({ data: { threadId } }),
  });

  const initialMessages: UIMessage[] = useMemo(() => {
    return (initial.data ?? []).map(
      (m): UIMessage => ({
        id: m.ai_sdk_id ?? m.id,
        role: m.role as UIMessage["role"],
        parts: (m.parts as UIMessage["parts"]) ?? [],
      }),
    );
  }, [initial.data]);

  if (initial.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-widest text-primary/70">
          Loading thread…
        </div>
      </div>
    );
  }

  return (
    <ChatRuntime
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      assistantName={profile.data?.assistant_name ?? "ARIA"}
      onMoodChange={setMood}
    />
  );
}

function ChatRuntime({
  threadId,
  initialMessages,
  assistantName,
  onMoodChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  assistantName: string;
  onMoodChange: (m: "idle" | "thinking" | "speaking") => void;
}) {
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ url: string; mediaType: string; name: string; uploading?: boolean }>
  >([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordUploadFn = _useServerFn2(recordUpload);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          headers.set("Content-Type", "application/json");
          let body = init?.body;
          if (typeof body === "string") {
            try {
              const parsed = JSON.parse(body);
              body = JSON.stringify({ ...parsed, threadId });
            } catch {
              /* leave */
            }
          }
          return fetch(input, { ...init, headers, body });
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    },
  });

  const orbState: OrbState =
    status === "submitted" || status === "streaming"
      ? "thinking"
      : error
        ? "alert"
        : "idle";

  useEffect(() => {
    if (orbState === "thinking") onMoodChange("thinking");
    else onMoodChange("idle");
  }, [orbState, onMoodChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  // Auto-speak the latest assistant message when voice mode is on.
  useEffect(() => {
    if (!voiceMode) return;
    if (status === "submitted" || status === "streaming") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (lastSpokenIdRef.current === last.id) return;
    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim();
    if (!text) return;
    lastSpokenIdRef.current = last.id;
    speak(text).catch(() => {});
  }, [messages, status, voiceMode]);

  async function speak(text: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/tts/lovable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      onMoodChange("speaking" as never);
      await audio.play();
      audio.onpause = () => onMoodChange("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "TTS failed");
    }
  }

  const isLoading = status === "submitted" || status === "streaming";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    const ready = attachments.filter((a) => !a.uploading);
    if ((!text && ready.length === 0) || isLoading) return;
    if (attachments.some((a) => a.uploading)) {
      toast.info("Attachments still uploading…");
      return;
    }
    setInput("");
    setAttachments([]);
    navigator.vibrate?.(8);
    const fileParts = ready.map((a) => ({
      type: "file" as const,
      url: a.url,
      mediaType: a.mediaType,
      filename: a.name,
    }));
    await sendMessage({
      parts: [
        ...fileParts,
        ...(text ? [{ type: "text" as const, text }] : []),
      ],
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const list = Array.from(files).slice(0, 6);
    for (const file of list) {
      const ext = file.name.split(".").pop() ?? "bin";
      const placeholder = {
        url: "",
        mediaType: file.type || "application/octet-stream",
        name: file.name,
        uploading: true,
      };
      setAttachments((arr) => [...arr, placeholder]);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id;
        if (!userId) throw new Error("Not signed in");
        const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("aria-uploads")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from("aria-uploads")
          .createSignedUrl(path, 60 * 60 * 24);
        if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Sign failed");
        await recordUploadFn({
          data: {
            path,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            threadId,
          },
        }).catch(() => {});
        setAttachments((arr) =>
          arr.map((a) =>
            a === placeholder
              ? {
                  url: signed.signedUrl,
                  mediaType: file.type || "application/octet-stream",
                  name: file.name,
                }
              : a,
          ),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        setAttachments((arr) => arr.filter((a) => a !== placeholder));
      }
    }
  }

  function removeAttachment(i: number) {
    setAttachments((arr) => arr.filter((_, idx) => idx !== i));
  }

  function handleTranscript(text: string) {
    if (isLoading) return;
    if (voiceMode) {
      void sendMessage({ text });
    } else {
      setInput((prev) => (prev ? prev + " " + text : text));
    }
  }

  const dropzone = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      void handleFiles(dt.files);
    },
  });

  return (
    <div
      {...dropzone.getRootProps({ className: "flex min-h-0 flex-1 flex-col relative" })}
    >
      <input {...dropzone.getInputProps()} />
      {dropzone.isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-primary/10 backdrop-blur-sm">
          <div className="hud-corner rounded-xl border-2 border-dashed border-primary/60 bg-card/80 px-6 py-4 font-display text-xs uppercase tracking-widest text-primary hud-text-glow">
            Drop to attach
          </div>
        </div>
      )}
      {/* Compact mobile HUD header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <ThreadDrawer
          activeThreadId={threadId}
          trigger={
            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-card/60 text-primary"
              aria-label="Conversations"
            >
              <Menu className="h-4 w-4" />
            </button>
          }
        />
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center">
            <JarvisOrb state={orbState} size={32} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-xs uppercase tracking-[0.25em] text-primary hud-text-glow">
              {assistantName}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {isLoading ? "Thinking…" : voiceMode ? "Voice · Live" : "Online"}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setVoiceMode((v) => !v);
            if (voiceMode) {
              audioRef.current?.pause();
            }
          }}
          aria-label="Toggle voice mode"
          className={`grid h-10 w-10 place-items-center rounded-lg border transition ${
            voiceMode
              ? "border-accent bg-accent/15 text-accent"
              : "border-primary/30 bg-card/60 text-primary"
          }`}
        >
          {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              className="grid place-items-center py-6 text-center"
            >
              <JarvisOrb state="idle" size={240} />
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mt-6 font-mono text-[11px] uppercase tracking-[0.4em] text-primary/80 hud-text-glow"
              >
                Awaiting Command
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-3 max-w-xs text-sm text-muted-foreground"
              >
                Tap the mic, or type. Toggle the speaker icon for hands-free voice mode.
              </motion.p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <MessageBubble message={m} assistantName={assistantName} />
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-primary/80"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest">Computing…</span>
              <span className="ml-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary/70"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </div>
      </div>


      {/* Composer */}
      <div className="relative border-t border-primary/15 bg-background/70 px-3 py-3 backdrop-blur-xl">
        <SpotifyHud />
        <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {attachments.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {attachments.map((a, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hud-corner relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-card/70"
              >
                {a.mediaType.startsWith("image/") && a.url ? (
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <Paperclip className="h-5 w-5 text-primary/70" />
                )}
                {a.uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-background/70">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background/80 text-foreground"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-end gap-2">
          <VoiceMic onTranscript={handleTranscript} disabled={isLoading} />
          <motion.div
            layout
            className="hud-corner relative flex-1 rounded-xl border border-primary/30 bg-card/60"
            animate={{
              boxShadow: input
                ? "0 0 0 1px hsl(var(--primary) / 0.55), 0 0 22px hsl(var(--primary) / 0.25)"
                : "0 0 0 1px hsl(var(--primary) / 0.15), 0 0 0 transparent",
            }}
            transition={{ duration: 0.25 }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e as unknown as React.FormEvent);
                }
              }}
              placeholder={`Speak to ${assistantName}…`}
              rows={1}
              className="block w-full resize-none bg-transparent px-3 py-3 pr-11 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              style={{ minHeight: 48, maxHeight: 160 }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach"
              className="absolute bottom-1.5 right-1.5 grid h-9 w-9 place-items-center rounded-md text-primary/70 transition hover:bg-primary/10 hover:text-primary"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </motion.div>
          {isLoading ? (
            <motion.button
              type="button"
              onClick={() => stop()}
              whileTap={{ scale: 0.9 }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-destructive/40 bg-destructive/15 text-destructive transition"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              type="submit"
              disabled={!input.trim() && attachments.filter((a) => !a.uploading).length === 0}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary bg-primary/15 text-primary transition disabled:opacity-40 ${
                input.trim() ? "animate-hud-breathe" : ""
              }`}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          )}
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, assistantName }: { message: UIMessage; assistantName: string }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  const files = message.parts.flatMap((p) =>
    p.type === "file"
      ? [{ url: (p as { url: string }).url, mediaType: (p as { mediaType: string }).mediaType, filename: (p as { filename?: string }).filename }]
      : [],
  );

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
          {files.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {files.map((f, i) =>
                f.mediaType?.startsWith("image/") ? (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer">
                    <img
                      src={f.url}
                      alt={f.filename ?? "attachment"}
                      className="max-h-48 max-w-[70vw] rounded-xl border border-primary/40 object-cover"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-primary/40 bg-card/70 px-2.5 py-1.5 text-xs text-foreground"
                  >
                    📎 {f.filename ?? "file"}
                  </a>
                ),
              )}
            </div>
          )}
          {text && (
            <div
              className="rounded-2xl rounded-tr-sm border border-primary/40 px-3.5 py-2.5 text-primary-foreground"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)",
                boxShadow:
                  "0 0 0 1px hsl(var(--primary) / 0.4), 0 6px 24px -8px hsl(var(--primary) / 0.5)",
              }}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tool invocations the model made during this assistant turn.
  const toolParts = message.parts.filter(
    (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
  ) as Array<{ type: string; state?: string; input?: unknown; output?: unknown }>;

  return (
    <div className="flex gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-card animate-hud-breathe">
        <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-display text-[10px] uppercase tracking-widest text-primary/80">
          {assistantName}
        </div>
        {toolParts.map((tp, i) => (
          <ToolChip key={i} part={tp} />
        ))}
        <div className="prose prose-invert prose-sm max-w-none break-words text-foreground/90 [&_a]:text-primary [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:py-0.5 [&_pre]:bg-card [&_pre]:border [&_pre]:border-primary/20">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function ToolChip({ part }: { part: { type: string; state?: string; output?: unknown } }) {
  const name = part.type.replace(/^tool-/, "");
  const label = name.replace(/_/g, " ");
  const running = part.state === "input-streaming" || part.state === "input-available";
  return (
    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-accent" : "bg-emerald-400"}`}
      />
      {running ? "calling" : "used"} · {label}
    </div>
  );
}
