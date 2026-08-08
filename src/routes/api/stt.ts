import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          // Ollama Cloud has no speech-to-text endpoint, so transcription always
          // runs through the built-in AI gateway.
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response("No transcription provider configured", { status: 500 });
          }

          const form = await request.formData();
          const audio = form.get("audio") as Blob | null;
          if (!audio || typeof (audio as Blob).size !== "number") {
            return new Response("Missing audio file", { status: 400 });
          }
          if (audio.size === 0) {
            return new Response("Empty audio", { status: 400 });
          }
          if (audio.size > 25 * 1024 * 1024) {
            return new Response("Audio too large (>25MB)", { status: 413 });
          }

          const maybeName = (audio as Blob & { name?: string }).name;
          const fileName =
            maybeName ||
            `recording.${(audio.type || "audio/webm").includes("mp4") ? "mp4" : "webm"}`;

          const upstream = new FormData();
          upstream.append("model", "openai/gpt-4o-mini-transcribe");
          upstream.append("file", audio, fileName);

          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
            },
            body: upstream,
          });

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            return new Response(`Transcription failed: ${body}`, { status: res.status });
          }

          const data = (await res.json()) as { text?: string };
          return Response.json({ text: data.text ?? "" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
