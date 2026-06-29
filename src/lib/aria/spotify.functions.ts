import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSpotifyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("spotify_tokens")
      .select("expires_at, scope")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, configured: !!process.env.SPOTIFY_CLIENT_ID };
  });

export const startSpotifyAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { spotifyAuthUrl } = await import("./spotify.server");
    // Encode userId as state (signed via secret available only server-side).
    const state = Buffer.from(JSON.stringify({ u: context.userId, t: Date.now() })).toString(
      "base64url",
    );
    return { url: spotifyAuthUrl(data.origin, state) };
  });

export const disconnectSpotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("spotify_tokens").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const getNowPlaying = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { spotifyFetch } = await import("./spotify.server");
    try {
      const res = await spotifyFetch(context.userId, "/me/player/currently-playing");
      if (res.status === 204 || res.status === 202) return { playing: false };
      if (!res.ok) return { playing: false, error: res.status };
      const json = (await res.json()) as {
        is_playing: boolean;
        progress_ms: number;
        item?: {
          name: string;
          duration_ms: number;
          artists?: Array<{ name: string }>;
          album?: { name: string; images?: Array<{ url: string }> };
          external_urls?: { spotify: string };
        };
      };
      if (!json.item) return { playing: false };
      return {
        playing: json.is_playing,
        progress_ms: json.progress_ms,
        duration_ms: json.item.duration_ms,
        track: json.item.name,
        artist: json.item.artists?.map((a) => a.name).join(", ") ?? "",
        album: json.item.album?.name ?? "",
        cover: json.item.album?.images?.[0]?.url ?? null,
        url: json.item.external_urls?.spotify ?? null,
      };
    } catch {
      return { playing: false };
    }
  });

type ControlAction = "play" | "pause" | "next" | "previous";

export const spotifyControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: ControlAction; uri?: string; volume?: number }) => d)
  .handler(async ({ data, context }) => {
    const { spotifyFetch } = await import("./spotify.server");
    let path = "";
    let method: "PUT" | "POST" = "PUT";
    let body: string | undefined;
    switch (data.action) {
      case "play":
        path = "/me/player/play";
        method = "PUT";
        if (data.uri) body = JSON.stringify({ uris: [data.uri] });
        break;
      case "pause":
        path = "/me/player/pause";
        method = "PUT";
        break;
      case "next":
        path = "/me/player/next";
        method = "POST";
        break;
      case "previous":
        path = "/me/player/previous";
        method = "POST";
        break;
    }
    const res = await spotifyFetch(context.userId, path, { method, body });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(`Spotify control failed: ${res.status} ${text}`);
    }
    return { ok: true };
  });

export const spotifySearchTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data, context }) => {
    const { spotifyFetch } = await import("./spotify.server");
    const res = await spotifyFetch(
      context.userId,
      `/search?type=track&limit=5&q=${encodeURIComponent(data.query)}`,
    );
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const json = (await res.json()) as {
      tracks?: {
        items: Array<{
          name: string;
          uri: string;
          artists: Array<{ name: string }>;
          album: { name: string; images?: Array<{ url: string }> };
        }>;
      };
    };
    return (json.tracks?.items ?? []).map((t) => ({
      name: t.name,
      uri: t.uri,
      artists: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      cover: t.album.images?.[0]?.url ?? null,
    }));
  });
