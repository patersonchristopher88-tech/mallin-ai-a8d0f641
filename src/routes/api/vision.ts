import { createFileRoute } from "@tanstack/react-router";
import { resolveChatEndpoint } from "@/lib/ai-provider.server";

/**
 * Live-vision endpoint. Accepts a base64 JPEG frame + optional prompt,
 * returns a short natural-language description via Gemini vision.
 */
export const Route = createFileRoute("/api/vision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

          const { imageBase64, prompt, brief } = (await request.json()) as {
            imageBase64: string;
            prompt?: string;
            brief?: boolean;
          };
          if (!imageBase64) return new Response("Missing imageBase64", { status: 400 });

          const dataUrl = imageBase64.startsWith("data:")
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

          const sys = brief
            ? "You are ARIA's live vision system. In ONE short sentence (max 18 words) describe what you see in the camera frame. Be specific, punchy, cinematic. No filler like 'I see' or 'the image shows'."
            : "You are ARIA's live vision system. Describe the camera frame with clear, useful detail. Answer any user question about it directly.";

          const ep = resolveChatEndpoint();
          const res = await fetch(ep.url, {
            method: "POST",
            headers: ep.headers,
            body: JSON.stringify({
              model: ep.model,
              messages: [
                { role: "system", content: sys },
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt?.trim() || "What do you see?" },
                    { type: "image_url", image_url: { url: dataUrl } },
                  ],
                },
              ],
            }),
          });
          if (!res.ok) {
            return new Response(await res.text(), { status: res.status });
          }
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = data.choices?.[0]?.message?.content?.trim() ?? "";
          return Response.json({ text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
