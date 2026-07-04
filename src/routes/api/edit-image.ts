import { createFileRoute } from "@tanstack/react-router";

// Streaming image edit via Lovable AI Gateway (Gemini 3.1 Flash Image / Nano Banana 2).
// Body: { prompt: string, imageDataUrl: string, model?: string }
// Returns SSE with image_generation.partial_image and image_generation.completed events.
export const Route = createFileRoute("/api/edit-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const {
          prompt,
          imageDataUrl,
          model = "google/gemini-3.1-flash-image",
        } = (await request.json()) as {
          prompt: string;
          imageDataUrl: string;
          model?: string;
        };
        if (!prompt || !imageDataUrl) return new Response("Missing prompt or image", { status: 400 });

        const body = {
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
          stream: true,
        };

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
