import { createFileRoute } from "@tanstack/react-router";
import { chatOnce, activeProvider } from "@/lib/ai-provider.server";

/**
 * ARIA 3D generation pipeline (Stability AI).
 *
 *  text  -> ARIA prompt enhancement -> Stability Stable Image Core (reference render)
 *        -> Stability 3D (image-to-3D) -> GLB -> Supabase storage -> signed URL
 *  image -> ARIA vision description  -> Stability 3D -> GLB -> signed URL
 *
 * Stability's 3D API is image-conditioned, so text requests are rendered to a
 * clean reference image first. Every stage is timed and reported so the
 * workspace diagnostics panel can show exactly where a failure happened.
 */

const STABILITY = "https://api.stability.ai";

type Body = {
  action?: "generate" | "status" | "enhance";
  prompt?: string;
  imageDataUrl?: string;
  quality?: "fast" | "detailed";
  enhance?: boolean;
};

type Stage = { stage: string; ms: number; detail?: string };

const ENHANCE_SYSTEM = [
  "You rewrite user requests into single-paragraph prompts for a text-to-3D asset pipeline.",
  "Always describe: the object only (no scene, no background clutter), full object visible, centred, three-quarter view,",
  "realistic materials with PBR detail, clean topology, production-ready game asset, neutral studio lighting, plain background.",
  "Never add text, humans, watermarks or multiple objects. Reply with the prompt only, no preamble, max 60 words.",
].join(" ");

function dataUrlToBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function stabilityBalance(key: string) {
  const res = await fetch(`${STABILITY}/v1/user/balance`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { ok: false, status: res.status, message: await res.text() };
  const j = (await res.json()) as { credits?: number };
  return { ok: true, status: 200, credits: j.credits ?? null };
}

/** Text -> reference image (PNG bytes). */
async function generateReferenceImage(key: string, prompt: string) {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  form.append("aspect_ratio", "1:1");
  const res = await fetch(`${STABILITY}/v2beta/stable-image/generate/core`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
    body: form,
  });
  if (!res.ok) throw new Error(`Stability image stage failed [${res.status}]: ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Image -> GLB bytes. Retries once on transient upstream failure. */
async function generateGlb(key: string, image: Uint8Array, mime: string, quality: "fast" | "detailed") {
  const endpoint =
    quality === "detailed"
      ? `${STABILITY}/v2beta/3d/stable-point-aware-3d`
      : `${STABILITY}/v2beta/3d/stable-fast-3d`;

  const attempt = async () => {
    const form = new FormData();
    form.append("image", new Blob([image as BlobPart], { type: mime }), "input.png");
    form.append("texture_resolution", quality === "detailed" ? "2048" : "1024");
    form.append("foreground_ratio", "0.85");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Stability 3D stage failed [${res.status}]: ${text}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return new Uint8Array(await res.arrayBuffer());
  };

  try {
    return await attempt();
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 0;
    // Retry only transient upstream failures.
    if (status >= 500 || status === 429 || status === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return attempt();
    }
    throw e;
  }
}

export const Route = createFileRoute("/api/model3d")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

        const stabilityKey = process.env.STABILITY_API_KEY;
        if (!stabilityKey) {
          return Response.json(
            { error: "STABILITY_API_KEY is not configured.", stage: "config" },
            { status: 500 },
          );
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const t0 = Date.now();
        const stages: Stage[] = [];
        const mark = (stage: string, from: number, detail?: string) =>
          stages.push({ stage, ms: Date.now() - from, detail });

        try {
          if (body.action === "status") {
            const bal = await stabilityBalance(stabilityKey);
            return Response.json({
              stability: bal,
              aiProvider: activeProvider(),
              endpoints: ["stable-image-core", "stable-fast-3d", "stable-point-aware-3d"],
            });
          }

          const quality = body.quality === "detailed" ? "detailed" : "fast";
          let enhanced = (body.prompt ?? "").trim();
          let referenceMime = "image/png";
          let referenceBytes: Uint8Array;

          if (body.imageDataUrl) {
            // Vision-to-3D: describe the scanned object, then reconstruct from the frame itself.
            const s = Date.now();
            const decoded = dataUrlToBytes(body.imageDataUrl);
            referenceBytes = decoded.bytes;
            referenceMime = decoded.mime;
            try {
              enhanced = await chatOnce([
                { role: "system", content: ENHANCE_SYSTEM },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Describe the main object in this photo as a 3D asset prompt.${
                        body.prompt ? ` User note: ${body.prompt}` : ""
                      }`,
                    },
                    { type: "image_url", image_url: { url: body.imageDataUrl } },
                  ],
                },
              ]);
            } catch {
              enhanced = body.prompt?.trim() || "scanned object";
            }
            mark("vision-analyse", s, enhanced.slice(0, 120));
          } else {
            if (!enhanced) return new Response("Missing prompt", { status: 400 });
            if (body.action === "enhance" || body.enhance !== false) {
              const s = Date.now();
              try {
                enhanced = await chatOnce([
                  { role: "system", content: ENHANCE_SYSTEM },
                  { role: "user", content: enhanced },
                ]);
              } catch {
                /* keep raw prompt if the language model is unavailable */
              }
              mark("prompt-enhance", s, enhanced.slice(0, 160));
            }
            if (body.action === "enhance") {
              return Response.json({ enhancedPrompt: enhanced, stages });
            }
            const s2 = Date.now();
            referenceBytes = await generateReferenceImage(stabilityKey, enhanced);
            mark("reference-image", s2, `${referenceBytes.byteLength} bytes`);
          }

          const s3 = Date.now();
          const glb = await generateGlb(stabilityKey, referenceBytes, referenceMime, quality);
          mark("mesh-3d", s3, `${glb.byteLength} bytes`);

          // Persist so the asset can be re-loaded, re-downloaded and shared.
          const s4 = Date.now();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const slug =
            (body.prompt ?? "model")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 40) || "model";
          const stamp = Date.now();
          const glbPath = `${slug}-${stamp}.glb`;
          const pngPath = `${slug}-${stamp}.png`;

          const up = await supabaseAdmin.storage
            .from("aria-models")
            .upload(glbPath, glb as unknown as ArrayBuffer, {
              contentType: "model/gltf-binary",
              upsert: true,
            });
          if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
          await supabaseAdmin.storage
            .from("aria-models")
            .upload(pngPath, referenceBytes as unknown as ArrayBuffer, {
              contentType: referenceMime,
              upsert: true,
            });

          const week = 60 * 60 * 24 * 7;
          const [{ data: signed }, { data: signedPng }] = await Promise.all([
            supabaseAdmin.storage.from("aria-models").createSignedUrl(glbPath, week),
            supabaseAdmin.storage.from("aria-models").createSignedUrl(pngPath, week),
          ]);
          if (!signed?.signedUrl) throw new Error("Could not sign model URL");
          mark("store", s4, glbPath);

          return Response.json({
            modelUrl: signed.signedUrl,
            previewUrl: signedPng?.signedUrl ?? null,
            path: glbPath,
            format: "glb",
            bytes: glb.byteLength,
            enhancedPrompt: enhanced,
            quality,
            provider: "stability",
            aiProvider: activeProvider(),
            totalMs: Date.now() - t0,
            stages,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "3D generation failed";
          return Response.json({ error: message, stages, totalMs: Date.now() - t0 }, { status: 502 });
        }
      },
    },
  },
});
