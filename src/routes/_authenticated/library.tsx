import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { listGenerations, listUploads } from "@/lib/aria/media.functions";

export const Route = createFileRoute("/_authenticated/library")({
  ssr: false,
  head: () => ({ meta: [{ title: "Library — ARIA" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const [tab, setTab] = useState<"generations" | "uploads">("generations");
  const listGens = useServerFn(listGenerations);
  const listUps = useServerFn(listUploads);

  const gens = useQuery({
    queryKey: ["generations"],
    queryFn: () => listGens(),
    enabled: tab === "generations",
  });
  const ups = useQuery({
    queryKey: ["uploads"],
    queryFn: () => listUps(),
    enabled: tab === "uploads",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <div className="font-display text-xs uppercase tracking-[0.3em] text-primary hud-text-glow">
          Library
        </div>
        <div className="flex rounded-lg border border-primary/25 bg-card/60 p-0.5">
          {(["generations", "uploads"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                tab === t ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {tab === t && (
                <motion.span
                  layoutId="lib-tab"
                  className="absolute inset-0 rounded-md bg-primary"
                />
              )}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {tab === "generations" ? (
          <Grid
            isLoading={gens.isLoading}
            empty={(gens.data?.length ?? 0) === 0}
            emptyHint="Head to Studio to create your first image or video."
            items={(gens.data ?? []).map((g) => ({
              id: g.id,
              url: g.url,
              label: g.prompt,
              kind: g.kind === "video" ? ("video" as const) : ("image" as const),
            }))}
          />
        ) : (
          <Grid
            isLoading={ups.isLoading}
            empty={(ups.data?.length ?? 0) === 0}
            emptyHint="Attach an image or file in chat to see it here."
            items={(ups.data ?? []).map((u) => ({
              id: u.id,
              url: u.url,
              label: u.original_name ?? "Untitled",
              kind: (u.mime_type ?? "").startsWith("image/") ? ("image" as const) : ("file" as const),
            }))}
          />
        )}
      </div>
    </div>
  );
}

function Grid({
  isLoading,
  empty,
  emptyHint,
  items,
}: {
  isLoading: boolean;
  empty: boolean;
  emptyHint: string;
  items: Array<{ id: string; url: string; label: string; kind: "image" | "file" | "video" }>;
}) {
  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/30 bg-card/50">
          <ImageIcon className="h-7 w-7 text-primary/70" />
        </div>
        <p className="mt-4 max-w-xs text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
      {items.map((it) => (
        <motion.a
          key={it.id}
          href={it.url}
          target="_blank"
          rel="noreferrer"
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="hud-corner group relative overflow-hidden rounded-xl border border-primary/25 bg-card/60"
        >
          {it.kind === "image" ? (
            <img src={it.url} alt={it.label} className="aspect-square w-full object-cover" />
          ) : it.kind === "video" ? (
            <video
              src={it.url}
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
            <div className="grid aspect-square w-full place-items-center bg-card/80">
              <FileText className="h-10 w-10 text-primary/70" />
            </div>
          )}
          {it.kind === "video" && (
            <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-md border border-accent/40 bg-background/80 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-accent">
              ▶ Video
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-2">
            <p className="line-clamp-2 text-[10px] text-foreground/90">{it.label}</p>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
