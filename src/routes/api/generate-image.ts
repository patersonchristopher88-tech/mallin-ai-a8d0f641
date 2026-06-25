import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Streaming image generation via the Lovable AI gateway.
 * SSE passthrough — partial frames are blurred client-side until final.
 * On final, the server uploads the base64 PNG to `aria-images` and inserts
 * a `generations` row, then forwards the upstream stream untouched.
 *
 * To avoid buffering the stream we *tee* it: one branch flows to the client
 * untouched; the other is parsed server-side to capture the final b64_json,
 * then persisted.
 */
export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return new Response("Missing env", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: u } = await supabase.auth.getUser(token);
        if (!u?.user) return new Response("Unauthorized", { status: 401 });
        const userId = u.user.id;

        const body = (await request.json()) as {
          prompt?: string;
          model?: string;
          quality?: "low" | "medium" | "high";
          size?: string;
          threadId?: string | null;
        };
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: body.model ?? "openai/gpt-image-2",
              prompt,
              quality: body.quality ?? "low",
              size: body.size ?? "1024x1024",
              stream: true,
              partial_images: 2,
            }),
          },
        );
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }

        const [toClient, toCapture] = upstream.body.tee();

        // Fire-and-forget capture of the final image — don't block client stream.
        (async () => {
          try {
            const reader = toCapture.getReader();
            const dec = new TextDecoder();
            let buf = "";
            let finalB64: string | null = null;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                const l = line.trim();
                if (!l.startsWith("data:")) continue;
                const payload = l.slice(5).trim();
                if (payload === "[DONE]") continue;
                try {
                  const evt = JSON.parse(payload) as {
                    type?: string;
                    b64_json?: string;
                    data?: Array<{ b64_json?: string }>;
                  };
                  const b64 =
                    evt.b64_json ??
                    evt.data?.[0]?.b64_json ??
                    null;
                  if (b64 && (!evt.type || evt.type.endsWith("completed") || evt.type === "image.generation"))
                    finalB64 = b64;
                  else if (b64) finalB64 = b64; // overwrite with latest
                } catch {
                  /* ignore */
                }
              }
            }
            if (!finalB64) return;
            const bytes = Uint8Array.from(atob(finalB64), (c) => c.charCodeAt(0));
            const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
            const { error: upErr } = await supabase.storage
              .from("aria-images")
              .upload(path, bytes, { contentType: "image/png", upsert: false });
            if (upErr) {
              console.error("[gen] upload failed:", upErr);
              return;
            }
            await supabase.from("generations").insert({
              user_id: userId,
              thread_id: body.threadId ?? null,
              kind: "image",
              model: body.model ?? "openai/gpt-image-2",
              prompt,
              storage_bucket: "aria-images",
              storage_path: path,
              metadata: { quality: body.quality ?? "low", size: body.size ?? "1024x1024" },
            });
          } catch (err) {
            console.error("[gen] capture error:", err);
          }
        })();

        return new Response(toClient, {
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
