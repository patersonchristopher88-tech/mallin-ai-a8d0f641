import { createFileRoute } from "@tanstack/react-router";

/**
 * Lovable AI TTS proxy. Returns audio/mpeg bytes.
 * Body: { text: string, voice?: string }
 */
export const Route = createFileRoute("/api/tts/lovable")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response("Missing LOVABLE_API_KEY", { status: 500 });
          }

          const { text, voice } = (await request.json()) as {
            text?: string;
            voice?: string;
          };
          if (!text || typeof text !== "string") {
            return new Response("Missing text", { status: 400 });
          }

          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              voice: voice ?? "alloy",
              input: text.slice(0, 4000),
              response_format: "mp3",
            }),
          });

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            return new Response(`TTS failed: ${body}`, { status: res.status });
          }

          return new Response(res.body, {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
