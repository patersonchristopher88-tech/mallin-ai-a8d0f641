import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Music2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/music")({
  ssr: false,
  head: () => ({ meta: [{ title: "Music — ARIA" }] }),
  component: MusicPage,
});

function MusicPage() {
  return (
    <div className="mx-auto flex min-h-0 max-w-2xl flex-1 flex-col px-4 py-4 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/chat"
          className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-card/60 text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Music2 className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
          Music Control
        </h1>
      </header>

      <div className="hud-corner rounded-xl border border-primary/25 bg-card/50 p-5">
        <h2 className="mb-2 font-display text-base text-primary">Spotify — coming online</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect your Spotify account so ARIA can play, pause, and search music by voice. Setup
          requires a Spotify developer app.
        </p>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Create an app at developer.spotify.com/dashboard</li>
          <li>Add redirect URI: <code className="rounded bg-card px-1">{typeof window !== "undefined" ? window.location.origin : ""}/music</code></li>
          <li>Paste the Client ID + Secret in Settings → Integrations (coming soon)</li>
        </ol>
        <a
          href="https://open.spotify.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-primary"
        >
          Open Spotify Web
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
