import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThreadMessages } from "@/lib/aria/threads.functions";
import { getProfile } from "@/lib/aria/profile.functions";
import { JarvisOrb, type OrbState } from "@/components/aria/JarvisOrb";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "@/components/aria/ThemeProvider";
import { toast } from "sonner";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          // Attach bearer + threadId on every request
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          headers.set("Content-Type", "application/json");
          // Merge threadId into body
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

  // Drive orb state from chat status
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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  const isLoading = status === "submitted" || status === "streaming";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="grid flex-1 grid-rows-[auto_1fr_auto]">
      {/* Top status bar */}
      <div className="flex items-center justify-between border-b border-primary/15 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center">
            <JarvisOrb state={orbState} size={36} />
          </div>
          <div>
            <div className="font-display text-sm uppercase tracking-widest text-primary hud-text-glow">
              {assistantName}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {isLoading ? "Thinking…" : "Online · Standby"}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="grid place-items-center py-12 text-center">
              <JarvisOrb state="idle" size={180} />
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.4em] text-primary/70">
                Awaiting Command
              </p>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                Ask anything. Voice, image generation, file uploads, and full customization arrive in the
                next system tick.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} assistantName={assistantName} />
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-3 text-primary/80">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest">Computing…</span>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-primary/15 bg-background/60 px-4 py-4 sm:px-8 backdrop-blur">
        <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="hud-corner relative flex-1 rounded-lg border border-primary/30 bg-card/60">
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
              className="block w-full resize-none bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              style={{ minHeight: 48, maxHeight: 200 }}
              autoFocus
            />
          </div>
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="grid h-12 w-12 place-items-center rounded-lg border border-destructive/40 bg-destructive/15 text-destructive transition hover:bg-destructive/25"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="grid h-12 w-12 place-items-center rounded-lg border border-primary bg-primary/15 text-primary transition hover:bg-primary/25 disabled:opacity-40 hud-glow"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Powered by Lovable AI · ARIA may make mistakes. Voice & files arrive in next update.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message, assistantName }: { message: UIMessage; assistantName: string }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-primary/40 bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-card">
        <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
      </div>
      <div className="flex-1">
        <div className="mb-1 font-display text-[11px] uppercase tracking-widest text-primary/80">
          {assistantName}
        </div>
        <div className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_a]:text-primary [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:py-0.5 [&_pre]:bg-card [&_pre]:border [&_pre]:border-primary/20">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
