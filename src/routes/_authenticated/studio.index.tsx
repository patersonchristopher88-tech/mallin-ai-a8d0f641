import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Sparkles, Star, Clock, X } from "lucide-react";
import {
  STUDIO_TOOLS,
  CATEGORIES,
  type StudioCategory,
} from "@/lib/aria/studio-tools";
import {
  getFavorites,
  getRecents,
  toggleFavorite,
} from "@/lib/aria/studio-favorites";

export const Route = createFileRoute("/_authenticated/studio/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Studio — ARIA Creative Workspace" }] }),
  component: StudioHub,
});

function StudioHub() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StudioCategory | "all" | "favorites" | "recents">("all");
  const [favs, setFavs] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setFavs(getFavorites());
    setRecents(getRecents());
  }, []);

  const filtered = useMemo(() => {
    let list = STUDIO_TOOLS;
    if (cat === "favorites") list = list.filter((t) => favs.includes(t.id));
    else if (cat === "recents") {
      const order = new Map(recents.map((id, i) => [id, i]));
      list = list
        .filter((t) => order.has(t.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (cat !== "all") {
      list = list.filter((t) => t.category === cat);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.tagline.toLowerCase().includes(query) ||
          t.category.includes(query),
      );
    }
    return list;
  }, [q, cat, favs, recents]);

  function onToggleFav(id: string) {
    setFavs(toggleFavorite(id));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-primary/15 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <Sparkles className="h-4 w-4 text-accent" />
          <div className="font-display text-xs uppercase tracking-[0.3em] text-primary hud-text-glow">
            Studio
          </div>
          <div className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {STUDIO_TOOLS.length} tools
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all tools…"
              className="hud-corner w-full rounded-xl border border-primary/25 bg-card/60 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="scrollbar-none mx-auto flex max-w-5xl gap-1.5 overflow-x-auto px-4 pb-3">
          <PillBtn active={cat === "all"} onClick={() => setCat("all")}>
            All
          </PillBtn>
          <PillBtn active={cat === "favorites"} onClick={() => setCat("favorites")}>
            <Star className="mr-1 inline h-3 w-3" />
            Favourites
          </PillBtn>
          <PillBtn active={cat === "recents"} onClick={() => setCat("recents")}>
            <Clock className="mr-1 inline h-3 w-3" />
            Recent
          </PillBtn>
          {CATEGORIES.map((c) => (
            <PillBtn key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              <span className="mr-1">{c.emoji}</span>
              {c.label}
            </PillBtn>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-5xl">
          {filtered.length === 0 ? (
            <div className="grid place-items-center py-20 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              No tools match your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((t, i) => {
                const isFav = favs.includes(t.id);
                const Icon = t.icon;
                const c = CATEGORIES.find((x) => x.id === t.category);
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="relative"
                  >
                    <Link
                      to="/studio/$toolId"
                      params={{ toolId: t.id }}
                      onClick={() => navigator.vibrate?.(8)}
                      className="hud-corner group block h-full rounded-2xl border border-primary/25 bg-card/50 p-3 transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card/80"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition group-hover:bg-primary/20">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                          {c?.emoji}
                        </span>
                      </div>
                      <div className="font-display text-[13px] leading-tight text-foreground">
                        {t.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {t.tagline}
                      </div>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        onToggleFav(t.id);
                      }}
                      className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border transition ${
                        isFav
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-transparent text-muted-foreground hover:border-primary/30 hover:bg-background/60"
                      }`}
                      aria-label={isFav ? "Unfavourite" : "Favourite"}
                    >
                      <Star className="h-3.5 w-3.5" fill={isFav ? "currentColor" : "none"} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PillBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
        active
          ? "border-primary bg-primary/20 text-primary hud-text-glow"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
