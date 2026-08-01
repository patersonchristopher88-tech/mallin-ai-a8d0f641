import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Mic,
  MessageSquare,
  Search,
  Sparkles,
  Wand2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { getProfile } from "@/lib/aria/profile.functions";
import { listThreads } from "@/lib/aria/threads.functions";
import { listGenerations } from "@/lib/aria/media.functions";
import { STUDIO_TOOLS } from "@/lib/aria/studio-tools";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Home — ARIA assistant dashboard" },
      {
        name: "description",
        content:
          "Your ARIA home: greeting, quick actions, recent conversations, projects and AI suggestions in one premium dashboard.",
      },
      { property: "og:title", content: "Home — ARIA assistant dashboard" },
      {
        property: "og:description",
        content: "Quick actions, recent chats, projects and daily AI suggestions.",
      },
    ],
  }),
  component: Home,
});

const SUGGESTIONS = [
  "Summarise my week and plan tomorrow",
  "Turn this photo into a cinematic poster",
  "Draft a reply that sounds like me",
  "Explain a hard topic like I'm 12",
  "Generate a 15s short from a prompt",
  "Review my code for security issues",
];

function greeting(h: number) {
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigate = useNavigate();
  const [now, setNow] = useState<Date | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const profileFn = useServerFn(getProfile);
  const threadsFn = useServerFn(listThreads);
  const gensFn = useServerFn(listGenerations);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });
  const threads = useQuery({ queryKey: ["threads", ""], queryFn: () => threadsFn({ data: {} }) });
  const gens = useQuery({ queryKey: ["generations"], queryFn: () => gensFn({}) });

  const name =
    (profile.data as { display_name?: string | null } | null)?.display_name?.split(" ")[0] ?? null;
  const assistant =
    (profile.data as { assistant_name?: string } | null)?.assistant_name ?? "ARIA";

  const lastThread = threads.data?.[0];
  const recentProjects = (gens.data ?? []).slice(0, 6);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    return {
      chats: (threads.data ?? []).filter((t) => t.title.toLowerCase().includes(term)).slice(0, 5),
      tools: STUDIO_TOOLS.filter(
        (t) =>
          t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term),
      ).slice(0, 6),
    };
  }, [q, threads.data]);

  const suggestion = useMemo(() => {
    const day = now ? now.getDate() : 0;
    return SUGGESTIONS[day % SUGGESTIONS.length];
  }, [now]);

  const quick = [
    { to: "/chat", label: "New chat", Icon: MessageSquare },
    { to: "/studio", label: "Studio", Icon: Sparkles },
    { to: "/vision", label: "Aria Vision", Icon: Camera },
    { to: "/projects", label: "Projects", Icon: FolderOpen },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6">
      {/* Greeting */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/70">
            {assistant} · online
          </p>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-foreground sm:text-3xl">
            {now ? greeting(now.getHours()) : "Hello"}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now
              ? now.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "\u00a0"}
          </p>
        </div>
        <Link
          to="/chat"
          aria-label="Talk to ARIA with your voice"
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary transition hover:bg-primary/20"
        >
          <Mic className="h-5 w-5" />
        </Link>
      </motion.header>

      {/* Search everything */}
      <div className="mt-5">
        <label className="sr-only" htmlFor="home-search">
          Search everything
        </label>
        <div className="hud-glass flex items-center gap-2 rounded-2xl border border-primary/25 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-primary/70" />
          <input
            id="home-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats, tools, projects…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {results && (
          <div className="hud-panel mt-2 space-y-3 rounded-2xl p-3">
            {results.chats.length === 0 && results.tools.length === 0 && (
              <p className="text-sm text-muted-foreground">No matches.</p>
            )}
            {results.chats.map((t) => (
              <Link
                key={t.id}
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="truncate">{t.title}</span>
              </Link>
            ))}
            {results.tools.map((t) => (
              <Link
                key={t.id}
                to="/studio/$toolId"
                params={{ toolId: t.id }}
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
              >
                <Wand2 className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="truncate">{t.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.35em] text-primary/70">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quick.map(({ to, label, Icon }) => (
            <motion.div key={to} whileTap={{ scale: 0.96 }}>
              <Link
                to={to}
                className="hud-panel hud-corner flex h-full flex-col gap-2 rounded-2xl p-3 transition hover:border-primary/50"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-display text-xs uppercase tracking-widest text-foreground">
                  {label}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Continue last chat */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.35em] text-primary/70">
          Continue
        </h2>
        {lastThread ? (
          <button
            onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: lastThread.id } })}
            className="hud-panel grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4 text-left transition hover:border-primary/50"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-sm text-foreground">{lastThread.title}</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(lastThread.updated_at).toLocaleString()}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
          </button>
        ) : (
          <Link
            to="/chat"
            className="hud-panel block rounded-2xl p-4 text-sm text-muted-foreground transition hover:border-primary/50"
          >
            No conversations yet — start your first chat.
          </Link>
        )}
      </section>

      {/* Recent projects */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-[11px] uppercase tracking-[0.35em] text-primary/70">
            Recent projects
          </h2>
          <Link to="/projects" className="font-mono text-[10px] uppercase tracking-widest text-primary">
            View all
          </Link>
        </div>
        {recentProjects.length ? (
          <div className="grid grid-cols-3 gap-2">
            {recentProjects.map((g) => (
              <Link
                key={g.id}
                to="/projects"
                className="group relative aspect-square overflow-hidden rounded-xl border border-primary/20 bg-card/50"
              >
                {g.url ? (
                  <img
                    src={g.url}
                    alt={g.prompt.slice(0, 80)}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            to="/studio"
            className="hud-panel block rounded-2xl p-4 text-sm text-muted-foreground transition hover:border-primary/50"
          >
            Nothing created yet — open Studio to make something.
          </Link>
        )}
      </section>

      {/* Daily suggestion */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.35em] text-primary/70">
          Suggested today
        </h2>
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="hud-panel hud-corner w-full rounded-2xl p-4 text-left transition hover:border-primary/50"
        >
          <span className="font-display text-sm text-foreground">{suggestion}</span>
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-primary/70">
            Tap to ask {assistant}
          </span>
        </button>
      </section>

      {/* Recent activity */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.35em] text-primary/70">
          Recent activity
        </h2>
        <ul className="hud-panel divide-y divide-primary/10 rounded-2xl">
          {[
            ...(threads.data ?? []).slice(0, 3).map((t) => ({
              key: `t-${t.id}`,
              label: t.title,
              at: t.updated_at,
              kind: "Chat",
            })),
            ...(gens.data ?? []).slice(0, 3).map((g) => ({
              key: `g-${g.id}`,
              label: g.prompt,
              at: g.created_at,
              kind: g.kind === "video" ? "Video" : "Image",
            })),
          ]
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, 5)
            .map((row) => (
              <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                <span className="truncate text-sm text-foreground">{row.label}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {row.kind}
                </span>
              </li>
            ))}
          {!threads.data?.length && !gens.data?.length && (
            <li className="p-3 text-sm text-muted-foreground">Nothing here yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
