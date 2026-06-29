// Server-only Spotify helpers (token exchange, refresh, API calls).
// Imported only from server function handlers / route handlers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "streaming",
].join(" ");

export function spotifyRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/spotify/callback`;
}

export function spotifyAuthUrl(origin: string, state: string) {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id) throw new Error("SPOTIFY_CLIENT_ID not set");
  const u = new URL("https://accounts.spotify.com/authorize");
  u.searchParams.set("client_id", id);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", spotifyRedirectUri(origin));
  u.searchParams.set("scope", SPOTIFY_SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

function basicAuth() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify credentials not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCode(code: string, origin: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(origin),
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

async function refreshToken(refresh: string) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };
}

export async function saveTokens(
  userId: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  },
) {
  const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin.from("spotify_tokens").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at,
    scope: tokens.scope ?? null,
  });
}

/** Returns a valid access token, refreshing if needed. Null = not connected. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at, scope")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const exp = new Date(data.expires_at).getTime();
  if (exp - Date.now() > 30_000) return data.access_token;
  try {
    const refreshed = await refreshToken(data.refresh_token);
    const expires_at = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("spotify_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at,
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
        ...(refreshed.scope ? { scope: refreshed.scope } : {}),
      })
      .eq("user_id", userId);
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function spotifyFetch(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("Spotify not connected");
  const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
