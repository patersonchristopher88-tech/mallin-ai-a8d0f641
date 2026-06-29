import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/spotify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) return redirectToSettings(url.origin, `spotify_error=${error}`);
          if (!code || !state) return redirectToSettings(url.origin, "spotify_error=missing_code");

          let userId: string | null = null;
          try {
            const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
              u?: string;
            };
            userId = parsed.u ?? null;
          } catch {
            return redirectToSettings(url.origin, "spotify_error=bad_state");
          }
          if (!userId) return redirectToSettings(url.origin, "spotify_error=no_user");

          const { exchangeCode, saveTokens } = await import("@/lib/aria/spotify.server");
          const tokens = await exchangeCode(code, url.origin);
          await saveTokens(userId, tokens);

          return redirectToSettings(url.origin, "spotify=connected");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          return new Response(`Spotify callback error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});

function redirectToSettings(origin: string, query: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/settings?${query}` },
  });
}
