// Server-side tool definitions for the chat streaming endpoint.
// Tools are bound per-user so they can call user-scoped APIs (Spotify, memory).

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getValidAccessToken, spotifyFetch } from "./spotify.server";

export function buildAriaTools(opts: { userId: string }): ToolSet {
  const { userId } = opts;

  return {
    get_weather: tool({
      description:
        "Get current weather for a location (city name or 'lat,lon'). Use when the user asks about weather, temperature, conditions, or what to wear outside.",
      inputSchema: z.object({
        location: z.string().describe("City name or 'lat,lon' coordinates"),
      }),
      execute: async ({ location }) => {
        try {
          // Geocode
          let lat: number, lon: number, displayName = location;
          const llMatch = location.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
          if (llMatch) {
            lat = parseFloat(llMatch[1]);
            lon = parseFloat(llMatch[2]);
          } else {
            const geo = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(location)}`,
            ).then((r) => r.json() as Promise<{ results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> }>);
            const hit = geo.results?.[0];
            if (!hit) return { error: `Location not found: ${location}` };
            lat = hit.latitude;
            lon = hit.longitude;
            displayName = `${hit.name}${hit.country ? ", " + hit.country : ""}`;
          }
          const wx = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius`,
          ).then((r) => r.json() as Promise<{ current?: Record<string, number> }>);
          return { location: displayName, ...wx.current };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "weather failed" };
        }
      },
    }),

    save_memory: tool({
      description:
        "Save a fact about the user for long-term recall. Use when the user shares preferences, identity, dates, projects, or anything they'd want remembered across sessions.",
      inputSchema: z.object({
        content: z.string().describe("One concise sentence to remember"),
      }),
      execute: async ({ content }) => {
        const { error } = await supabaseAdmin
          .from("memories")
          .insert({ user_id: userId, content, kind: "fact" });
        if (error) return { ok: false, error: error.message };
        return { ok: true, saved: content };
      },
    }),

    spotify_now_playing: tool({
      description: "Get what the user is currently listening to on Spotify.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getValidAccessToken(userId);
        if (!token) return { connected: false };
        const res = await spotifyFetch(userId, "/me/player/currently-playing");
        if (res.status === 204) return { connected: true, playing: false };
        if (!res.ok) return { connected: true, playing: false, error: res.status };
        const j = (await res.json()) as {
          is_playing: boolean;
          item?: { name: string; artists?: Array<{ name: string }> };
        };
        return {
          connected: true,
          playing: j.is_playing,
          track: j.item?.name,
          artist: j.item?.artists?.map((a) => a.name).join(", "),
        };
      },
    }),

    spotify_play: tool({
      description:
        "Play music on Spotify. Provide a search query (e.g. 'Bohemian Rhapsody by Queen') to search and play the top result, or omit to resume current playback.",
      inputSchema: z.object({
        query: z.string().optional().describe("Track / artist / album search query"),
      }),
      execute: async ({ query }) => {
        const token = await getValidAccessToken(userId);
        if (!token) return { ok: false, error: "Spotify not connected" };
        if (query) {
          const sr = await spotifyFetch(
            userId,
            `/search?type=track&limit=1&q=${encodeURIComponent(query)}`,
          );
          if (!sr.ok) return { ok: false, error: `Search failed: ${sr.status}` };
          const sj = (await sr.json()) as {
            tracks?: { items: Array<{ uri: string; name: string; artists: Array<{ name: string }> }> };
          };
          const hit = sj.tracks?.items?.[0];
          if (!hit) return { ok: false, error: "No track found" };
          const play = await spotifyFetch(userId, "/me/player/play", {
            method: "PUT",
            body: JSON.stringify({ uris: [hit.uri] }),
          });
          if (!play.ok && play.status !== 204)
            return { ok: false, error: `Play failed: ${play.status} — open Spotify on a device first` };
          return {
            ok: true,
            playing: `${hit.name} — ${hit.artists.map((a) => a.name).join(", ")}`,
          };
        }
        const r = await spotifyFetch(userId, "/me/player/play", { method: "PUT" });
        if (!r.ok && r.status !== 204) return { ok: false, error: `Resume failed: ${r.status}` };
        return { ok: true, resumed: true };
      },
    }),

    spotify_pause: tool({
      description: "Pause Spotify playback.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await spotifyFetch(userId, "/me/player/pause", { method: "PUT" });
        if (!r.ok && r.status !== 204) return { ok: false, error: r.status };
        return { ok: true };
      },
    }),

    spotify_next: tool({
      description: "Skip to the next track on Spotify.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await spotifyFetch(userId, "/me/player/next", { method: "POST" });
        if (!r.ok && r.status !== 204) return { ok: false, error: r.status };
        return { ok: true };
      },
    }),

    spotify_previous: tool({
      description: "Go to the previous track on Spotify.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await spotifyFetch(userId, "/me/player/previous", { method: "POST" });
        if (!r.ok && r.status !== 204) return { ok: false, error: r.status };
        return { ok: true };
      },
    }),

    spotify_volume: tool({
      description: "Set Spotify playback volume (0-100).",
      inputSchema: z.object({ percent: z.number().int().min(0).max(100) }),
      execute: async ({ percent }) => {
        const r = await spotifyFetch(
          userId,
          `/me/player/volume?volume_percent=${percent}`,
          { method: "PUT" },
        );
        if (!r.ok && r.status !== 204) return { ok: false, error: r.status };
        return { ok: true, volume: percent };
      },
    }),
  };
}
