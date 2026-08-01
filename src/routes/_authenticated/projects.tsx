import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Search,
  Star,
  Video,
} from "lucide-react";
import { listGenerations, listUploads } from "@/lib/aria/media.functions";
import { listThreads } from "@/lib/aria/threads.functions";

export const Route = createFileRoute("/_authenticated/projects")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Projects — ARIA workspace" },
      {
        name: "description",
        content:
          "Every conversation, image, video and document you've made with ARIA, searchable and filterable in one workspace.",
      },
      { property: "og:title", content: "Projects — ARIA workspace" },
      {
        property: "og:description",
        content: "Search, filter and favourite all your ARIA chats, media and files.",
      },
    ],
  }),
  component: Projects,
});

const FAV_KEY = "aria:projects:favorites";

type Filter = "all" | "chats" | "images" | "videos" | "files" | "starred";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "starred", label: "Starred" },
  { id: "chats", label: "Chats" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "files", label: "Files" },
];

type Item = {
  id: string;
  kind: "chat" | "image" | "video" | "file";
  title: string;
  at: string;
  url?: string;
  href?: { to: "/chat/$threadId"; params: { threadId: string } };
};

export default function Projects() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "name">("recent");
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      if (raw) setFavs(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFav = (id: string) => {
    setFavs((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const threadsFn = useServerFn(listThreads);
  const gensFn = useServerFn(listGenerations);
  const uploadsFn = useServerFn(listUploads);

  const threads = useQuery({ queryKey: ["threads", ""], queryFn: () => threadsFn({ data: {} }) });
  const gens = useQuery({ queryKey: ["generations"], queryFn: () => gensFn({}) });
  const uploads = useQuery({ queryKey: ["uploads"], queryFn: () => uploadsFn({}) });

  const loading = threads.isLoading || gens.isLoading || uploads.isLoading;

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...(threads.data ?? []).map((t) => ({
        id: `chat:${t.id}`,
        kind: "chat" as const,
        title: t.title,
        at: t.updated_at,
        href: { to: "/chat/$threadId" as const, params: { threadId: t.id } },
      })),
      ...(gens.data ?? []).map((g) => ({
        id: `gen:${g.id}`,
        kind: (g.kind === "video" ? "video" : "image") as "video" | "image",
        title: g.prompt,
        at: g.created_at,
        url: g.url,
      })),
      ...(uploads.data ?? []).map((u) => ({
        id: `up:${u.id}`,
        kind: (u.mime_type?.startsWith("image/") ? "image" : "file") as "image" | "file",
        title: u.original_name ?? "Untitled file",
        at: u.created_at,
        url: u.url,
      })),
    ];

    const term = q.trim().toLowerCase();
    const filtered = all.filter((it) => {
      if (term && !it.title.toLowerCase().includes(term)) return false;
      if (filter === "all") return true;
      if (filter === "starred") return favs.includes(it.id);
      if (filter === "chats") return it.kind === "chat";
      if (filter === "images") return it.kind === "image";
      if (filter === "videos") return it.kind === "video";
      return it.kind === "file";
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "oldest") return a.at.localeCompare(b.at);
      return b.at.localeCompare(a.at);
    });
  }, [threads.data, gens.data, uploads.data, q, filter, favs, sort]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/70">
            Workspace
          </p>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-foreground">Projects</h1>
        </div>
        <select
          aria-label="Sort projects"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="hud-glass shrink-0 rounded-xl border border-primary/25 bg-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground"
        >
          <option value="recent">Recent</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
        </select>
      </header>

      <div className="hud-glass mt-4 flex items-center gap-2 rounded-2xl border border-primary/25 px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-primary/70" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects…"
          aria-label="Search projects"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
              filter === f.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-primary/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="hud-panel mt-4 rounded-2xl p-4 text-sm text-muted-foreground">
          Nothing here yet. Start a chat or create something in Studio.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((it, i) => {
            const Icon =
              it.kind === "chat"
                ? MessageSquare
                : it.kind === "video"
                  ? Video
                  : it.kind === "image"
                    ? ImageIcon
                    : FileText;
            const body = (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                {it.url && it.kind !== "chat" ? (
                  <img
                    src={it.url}
                    alt={it.title.slice(0, 60)}
                    loading="lazy"
                    className="size-11 shrink-0 rounded-xl border border-primary/20 object-cover"
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{it.title}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {it.kind} · {new Date(it.at).toLocaleDateString()}
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFav(it.id);
                  }}
                  aria-label={favs.includes(it.id) ? "Remove from starred" : "Add to starred"}
                  className="shrink-0 p-1 text-muted-foreground transition hover:text-primary"
                >
                  <Star
                    className={`h-4 w-4 ${favs.includes(it.id) ? "fill-primary text-primary" : ""}`}
                  />
                </button>
              </div>
            );

            return (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                className="hud-panel rounded-2xl p-3 transition hover:border-primary/50"
              >
                {it.href ? (
                  <Link to={it.href.to} params={it.href.params} className="block">
                    {body}
                  </Link>
                ) : it.url ? (
                  <a href={it.url} target="_blank" rel="noreferrer" className="block">
                    {body}
                  </a>
                ) : (
                  body
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
