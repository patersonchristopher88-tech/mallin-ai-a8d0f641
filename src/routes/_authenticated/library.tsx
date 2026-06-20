import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  ssr: false,
  head: () => ({ meta: [{ title: "Library — ARIA" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="hud-corner grid h-20 w-20 place-items-center rounded-2xl border border-primary/40 bg-primary/10">
        <ImageIcon className="h-9 w-9 text-primary" />
      </div>
      <h1 className="mt-6 font-display text-xl uppercase tracking-[0.3em] text-primary hud-text-glow">
        Library
      </h1>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        Your generated images and uploaded files will live here. Coming with Studio.
      </p>
    </div>
  );
}
