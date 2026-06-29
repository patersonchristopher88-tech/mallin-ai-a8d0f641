import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSpotifyStatus, startSpotifyAuth, disconnectSpotify } from "@/lib/aria/spotify.functions";
import { toast } from "sonner";
import { Music2, Check, ExternalLink } from "lucide-react";

export function SpotifyConnectCard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getSpotifyStatus);
  const startFn = useServerFn(startSpotifyAuth);
  const disconnectFn = useServerFn(disconnectSpotify);

  const status = useQuery({ queryKey: ["spotify-status"], queryFn: () => statusFn() });

  const connect = useMutation({
    mutationFn: async () => {
      const r = await startFn({ data: { origin: window.location.origin } });
      window.location.href = r.url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start Spotify auth"),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spotify-status"] });
      qc.invalidateQueries({ queryKey: ["spotify-now"] });
      toast.success("Spotify disconnected");
    },
  });

  const connected = status.data?.connected;
  const configured = status.data?.configured;

  return (
    <div className="hud-corner rounded-lg border border-accent/30 bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-accent">
            Spotify {connected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Voice-control playback (&ldquo;play Bohemian Rhapsody&rdquo;) and see Now Playing in the chat HUD.
          </p>
          {!configured && (
            <p className="mt-2 text-[11px] text-amber-400/90">
              Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to enable.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="hud-corner rounded border border-border bg-card px-3 py-1.5 font-display text-[11px] uppercase tracking-widest text-foreground/70 hover:text-foreground"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect.mutate()}
            disabled={!configured || connect.isPending}
            className="hud-corner inline-flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 font-display text-[11px] uppercase tracking-widest text-accent transition hover:bg-accent/25 disabled:opacity-40"
          >
            Connect <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
