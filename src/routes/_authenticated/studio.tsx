import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Studio — ARIA" }] }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="hud-corner grid h-20 w-20 place-items-center rounded-2xl border border-primary/40 bg-primary/10">
        <Sparkles className="h-9 w-9 text-primary" />
      </div>
      <h1 className="mt-6 font-display text-xl uppercase tracking-[0.3em] text-primary hud-text-glow">
        Studio
      </h1>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        Generate and edit images with AI. Coming in the next system tick — streaming previews,
        size presets, and prompt-based edits.
      </p>
    </div>
  );
}
