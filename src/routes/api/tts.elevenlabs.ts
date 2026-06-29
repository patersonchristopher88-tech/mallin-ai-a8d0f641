import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/tts/elevenlabs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)
          return new Response("Missing env", { status: 500 });
        if (!ELEVEN_KEY) return new Response("ElevenLabs not connected", { status: 503 });

        const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: userData } = await userClient.auth.getUser(token);
        if (!userData?.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          text: string;
          voiceId?: string;
          modelId?: string;
        };
        if (!body.text) return new Response("Missing text", { status: 400 });

        const voiceId = body.voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George — JARVIS-ish
        const modelId = body.modelId || "eleven_turbo_v2_5";

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ text: body.text, model_id: modelId }),
          },
        );
        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          return new Response(t || "TTS failed", { status: res.status });
        }
        return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
      },
    },
  },
});
