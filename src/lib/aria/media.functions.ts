import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GenerationRow = {
  id: string;
  prompt: string;
  model: string;
  kind: string;
  created_at: string;
  url: string; // signed
  path: string;
};

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GenerationRow[]> => {
    const { data, error } = await context.supabase
      .from("generations")
      .select("id, prompt, model, kind, created_at, storage_bucket, storage_path")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return [];
    const byBucket = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byBucket.get(r.storage_bucket) ?? [];
      arr.push(r);
      byBucket.set(r.storage_bucket, arr);
    }
    const out: GenerationRow[] = [];
    for (const [bucket, list] of byBucket) {
      const { data: signed } = await context.supabase.storage
        .from(bucket)
        .createSignedUrls(list.map((r) => r.storage_path), 3600);
      const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
      for (const r of list) {
        out.push({
          id: r.id,
          prompt: r.prompt,
          model: r.model,
          kind: r.kind,
          created_at: r.created_at,
          url: urlByPath.get(r.storage_path) ?? "",
          path: r.storage_path,
        });
      }
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

export const deleteGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generations")
      .select("storage_bucket, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row) {
      await context.supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
    }
    await context.supabase.from("generations").delete().eq("id", data.id);
    return { ok: true };
  });

export type UploadRow = {
  id: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string;
};

export const listUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UploadRow[]> => {
    const { data, error } = await context.supabase
      .from("uploads")
      .select("id, original_name, mime_type, size_bytes, created_at, storage_bucket, storage_path")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return [];
    const { data: signed } = await context.supabase.storage
      .from("aria-uploads")
      .createSignedUrls(rows.map((r) => r.storage_path), 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
    return rows.map((r) => ({
      id: r.id,
      original_name: r.original_name,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      created_at: r.created_at,
      url: urlByPath.get(r.storage_path) ?? "",
    }));
  });

export const recordUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      path: string;
      name: string;
      mime: string;
      size: number;
      threadId?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("uploads")
      .insert({
        user_id: context.userId,
        thread_id: data.threadId ?? null,
        kind: data.mime.startsWith("image/") ? "image" : "file",
        storage_bucket: "aria-uploads",
        storage_path: data.path,
        original_name: data.name,
        mime_type: data.mime,
        size_bytes: data.size,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
