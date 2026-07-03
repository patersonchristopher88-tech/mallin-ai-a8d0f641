import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string; folder?: string | null } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("threads")
      .select("id, title, persona, folder, pinned, updated_at")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.folder !== undefined) {
      if (data.folder === null) q = q.is("folder", null);
      else q = q.eq("folder", data.folder);
    }
    if (data.search && data.search.trim()) {
      q = q.ilike("title", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("folder")
      .not("folder", "is", null);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    (data ?? []).forEach((r: { folder: string | null }) => {
      if (r.folder) set.add(r.folder);
    });
    return Array.from(set).sort();
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title?: string; persona?: string; folder?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "New conversation",
        persona: data.persona ?? null,
        folder: data.folder ?? null,
      })
      .select("id, title, persona, folder, pinned, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; title: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateThreadFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; folder: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ folder: data.folder })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleThreadPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; pinned: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ pinned: data.pinned })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, ai_sdk_id, role, parts, mood, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
