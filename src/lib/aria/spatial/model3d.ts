import { supabase } from "@/integrations/supabase/client";

export interface Model3DStage {
  stage: string;
  ms: number;
  detail?: string;
}

export interface Model3DResult {
  modelUrl: string;
  previewUrl: string | null;
  path: string;
  format: "glb";
  bytes: number;
  enhancedPrompt: string;
  quality: "fast" | "detailed";
  provider: string;
  aiProvider: string;
  totalMs: number;
  stages: Model3DStage[];
}

export interface Model3DDiagnostics {
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  materialsOk: boolean;
  texturesOk: boolean;
  rendererError: string | null;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
}

/** Text-to-3D or image(vision)-to-3D through Stability, with ARIA prompt enhancement. */
export async function generateModel3D(body: {
  prompt?: string;
  imageDataUrl?: string;
  quality?: "fast" | "detailed";
}): Promise<Model3DResult> {
  const res = await fetch("/api/model3d", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "generate", ...body }),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const err = (json as { error?: string } | null)?.error ?? text ?? "3D generation failed";
    throw new Error(err);
  }
  return json as Model3DResult;
}

export async function model3dStatus(): Promise<{
  stability: { ok: boolean; status: number; credits?: number | null; message?: string };
  aiProvider: string;
  endpoints: string[];
}> {
  const res = await fetch("/api/model3d", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "status" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ------------------------------------------------- spatial manipulation ops */

export type ModelOp =
  | { op: "scale"; factor: number }
  | { op: "rotate"; deg: number; axis: "y" | "x" }
  | { op: "view"; side: "front" | "rear" | "left" | "right" | "top" }
  | { op: "reset" }
  | { op: "focus" }
  | { op: "spin"; on: boolean }
  | { op: "wireframe" }
  | { op: "isolate" };

/** Voice/text control of the live 3D asset: "enlarge the model", "rotate it 90 degrees", ... */
export function parseModelOp(input: string): ModelOp | null {
  const t = input
    .toLowerCase()
    .replace(/^(hey |ok |okay |aria[,: ]*|please )+/g, "")
    .trim();

  if (/\b(reset|default view|start over|centre it|center it)\b/.test(t)) return { op: "reset" };
  if (/\b(focus|frame it|fit (it )?(to|in) (the )?(view|screen)|zoom to fit)\b/.test(t)) return { op: "focus" };
  if (/\b(isolate|solo|just that part|only that part)\b/.test(t)) return { op: "isolate" };
  if (/\b(wireframe|x-?ray|see through)\b/.test(t)) return { op: "wireframe" };
  if (/\b(stop (spinning|rotating)|freeze it|hold still)\b/.test(t)) return { op: "spin", on: false };
  if (/\b(spin it|keep (it )?(spinning|rotating)|auto.?rotate)\b/.test(t)) return { op: "spin", on: true };

  if (/\b(enlarge|bigger|scale (it )?up|zoom in|blow it up|make it (bigger|larger))\b/.test(t))
    return { op: "scale", factor: 1.35 };
  if (/\b(shrink|smaller|scale (it )?down|zoom out|make it smaller)\b/.test(t))
    return { op: "scale", factor: 1 / 1.35 };

  const rot = t.match(/\brotate (?:it |the model )?(?:by )?(-?\d{1,3})\s*(?:degrees?|deg)?\b/);
  if (rot) return { op: "rotate", deg: Number(rot[1]), axis: /\b(up|down|pitch|vertical)\b/.test(t) ? "x" : "y" };
  if (/\b(rotate|turn) (it|the model)\b/.test(t)) return { op: "rotate", deg: 90, axis: "y" };
  if (/\b(tilt|pitch)\b/.test(t)) return { op: "rotate", deg: 30, axis: "x" };

  if (/\b(rear|back) (view|side)\b|\bshow (me )?the (rear|back)\b/.test(t)) return { op: "view", side: "rear" };
  if (/\bfront (view|side)\b|\bshow (me )?the front\b/.test(t)) return { op: "view", side: "front" };
  if (/\bleft (view|side)\b/.test(t)) return { op: "view", side: "left" };
  if (/\bright (view|side)\b/.test(t)) return { op: "view", side: "right" };
  if (/\b(top|bird'?s eye|above) (view|down)?\b/.test(t)) return { op: "view", side: "top" };

  return null;
}
