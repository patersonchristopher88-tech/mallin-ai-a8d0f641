import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Video generation via fal.ai (Kling 2 master).
 * Text-to-video or image-to-video. Polls the queue, then uploads the mp4
 * to `aria-images` bucket and inserts a `generations` row (kind: 'video').
 *
 * Streams SSE events to the client:
 *   { type: 'status', status, position?, logs? }
 *   { type: 'final', url, generationId, prompt }
 *   { type: 'error', message }
 */
export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)
          return new Response("Missing Supabase env", { status: 500 });
        if (!FAL_API_KEY)
          return new Response("Missing FAL_API_KEY", { status: 500 });

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: u } = await supabase.auth.getUser(token);
        if (!u?.user) return new Response("Unauthorized", { status: 401 });
        const userId = u.user.id;

        const body = (await request.json()) as {
          prompt?: string;
          imageUrl?: string | null;
          duration?: "5" | "10";
          aspectRatio?: "16:9" | "9:16" | "1:1";
          threadId?: string | null;
          mode?: "fast" | "cinematic";
        };
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        // Model selection. Kling 2.5 master = cinematic. LTX = fast/cheap.
        const cinematic = (body.mode ?? "cinematic") === "cinematic";
        const hasImage = !!body.imageUrl;
        const endpointBase = cinematic
          ? hasImage
            ? "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"
            : "fal-ai/kling-video/v2.5-turbo/pro/text-to-video"
          : hasImage
            ? "fal-ai/ltx-video-13b-distilled/image-to-video"
            : "fal-ai/ltx-video-13b-distilled";

        const payload: Record<string, unknown> = {
          prompt,
          duration: body.duration ?? "5",
          aspect_ratio: body.aspectRatio ?? "16:9",
        };
        if (hasImage) payload.image_url = body.imageUrl;

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (obj: unknown) =>
              controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
            try {
              send({ type: "status", status: "queueing" });

              const submitRes = await fetch(`https://queue.fal.run/${endpointBase}`, {
                method: "POST",
                headers: {
                  Authorization: `Key ${FAL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });
              if (!submitRes.ok) {
                const txt = await submitRes.text();
                send({ type: "error", message: `fal submit ${submitRes.status}: ${txt}` });
                controller.close();
                return;
              }
              const submit = (await submitRes.json()) as {
                request_id: string;
                status_url: string;
                response_url: string;
              };
              send({ type: "status", status: "in_queue", requestId: submit.request_id });

              // Poll status until completed (max ~8 min)
              const start = Date.now();
              let result: { video?: { url: string } } | null = null;
              while (Date.now() - start < 8 * 60 * 1000) {
                await new Promise((r) => setTimeout(r, 2500));
                const sRes = await fetch(submit.status_url, {
                  headers: { Authorization: `Key ${FAL_API_KEY}` },
                });
                if (!sRes.ok) continue;
                const s = (await sRes.json()) as {
                  status: string;
                  queue_position?: number;
                  logs?: { message: string }[];
                };
                send({
                  type: "status",
                  status: s.status,
                  position: s.queue_position,
                  log: s.logs?.[s.logs.length - 1]?.message,
                });
                if (s.status === "COMPLETED") {
                  const rRes = await fetch(submit.response_url, {
                    headers: { Authorization: `Key ${FAL_API_KEY}` },
                  });
                  result = (await rRes.json()) as { video?: { url: string } };
                  break;
                }
                if (s.status === "FAILED" || s.status === "ERROR") {
                  send({ type: "error", message: `fal job ${s.status}` });
                  controller.close();
                  return;
                }
              }

              if (!result?.video?.url) {
                send({ type: "error", message: "Timed out waiting for video" });
                controller.close();
                return;
              }

              send({ type: "status", status: "saving" });
              const vidRes = await fetch(result.video.url);
              if (!vidRes.ok) {
                send({ type: "error", message: "Could not download video" });
                controller.close();
                return;
              }
              const buf = new Uint8Array(await vidRes.arrayBuffer());
              const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp4`;
              const { error: upErr } = await supabase.storage
                .from("aria-images")
                .upload(path, buf, { contentType: "video/mp4", upsert: false });
              if (upErr) {
                send({ type: "error", message: `Storage: ${upErr.message}` });
                controller.close();
                return;
              }
              const { data: gen } = await supabase
                .from("generations")
                .insert({
                  user_id: userId,
                  thread_id: body.threadId ?? null,
                  kind: "video",
                  model: endpointBase,
                  prompt,
                  storage_bucket: "aria-images",
                  storage_path: path,
                  metadata: {
                    duration: body.duration ?? "5",
                    aspect_ratio: body.aspectRatio ?? "16:9",
                    has_image: hasImage,
                    mode: body.mode ?? "cinematic",
                  },
                })
                .select("id")
                .single();
              const { data: signed } = await supabase.storage
                .from("aria-images")
                .createSignedUrl(path, 60 * 60);
              send({
                type: "final",
                url: signed?.signedUrl ?? "",
                generationId: gen?.id ?? null,
                prompt,
              });
              controller.close();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              try {
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`),
                );
              } catch {
                /* ignore */
              }
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
