import { createFileRoute } from "@tanstack/react-router";

/**
 * ElevenLabs TTS proxy. Streams mp3 audio.
 * Body: { text: string, voiceId?: string, modelId?: string }
 */
export const Route = createFileRoute("/api/tts/elevenlabs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const key = process.env.ELEVENLABS_API_KEY;
          if (!key) return new Response("ElevenLabs not connected", { status: 500 });

          const { text, voiceId, modelId } = (await request.json()) as {
            text?: string;
            voiceId?: string;
            modelId?: string;
          };
          if (!text || typeof text !== "string") {
            return new Response("Missing text", { status: 400 });
          }

          const v = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George
          const m = modelId || "eleven_turbo_v2_5";

          const res = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${v}/stream?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: text.slice(0, 4500),
                model_id: m,
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  style: 0.35,
                  use_speaker_boost: true,
                },
              }),
            },
          );

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            return new Response(`ElevenLabs TTS failed: ${body}`, { status: res.status });
          }

          return new Response(res.body, {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Internal error", { status: 500 });
        }
      },
    },
  },
});
