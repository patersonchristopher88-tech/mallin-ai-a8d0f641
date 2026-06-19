import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, unknown>) => data)
  .handler(async ({ data, context }) => {
    // Supabase's generated update type is exact; we accept loose objects from the client
    // (settings UI), so cast at the boundary.
    const { error } = await context.supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(data as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
