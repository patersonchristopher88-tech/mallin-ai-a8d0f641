import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildSystemPrompt, type PersonaKey } from "@/lib/aria/personas";

type ChatRequestBody = {
  messages?: UIMessage[];
  threadId?: string;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = auth.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response("Missing Supabase env", { status: 500 });
          }
          if (!LOVABLE_API_KEY) {
            return new Response("Missing LOVABLE_API_KEY", { status: 500 });
          }

          const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });
          const { data: userData, error: userErr } = await userClient.auth.getUser(token);
          if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const { messages, threadId } = (await request.json()) as ChatRequestBody;
          if (!Array.isArray(messages) || !threadId) {
            return new Response("Bad request", { status: 400 });
          }

          // Verify thread ownership
          const { data: thread } = await userClient
            .from("threads")
            .select("id, user_id, persona")
            .eq("id", threadId)
            .maybeSingle();
          if (!thread || thread.user_id !== userId) {
            return new Response("Thread not found", { status: 404 });
          }

          // Load profile + recent memories for system prompt
          const [{ data: profile }, { data: memories }] = await Promise.all([
            userClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
            userClient
              .from("memories")
              .select("content")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(20),
          ]);

          const systemPrompt = buildSystemPrompt({
            persona: (profile?.persona ?? "jarvis") as PersonaKey,
            customPrompt: profile?.system_prompt ?? null,
            assistantName: profile?.assistant_name ?? "ARIA",
            userName: profile?.display_name ?? null,
            verbosity: profile?.verbosity ?? 50,
            formality: profile?.formality ?? 50,
            memories: (memories ?? []).map((m) => m.content),
            timezone: profile?.timezone ?? null,
          });

          const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
          const model = gateway(profile?.default_chat_model ?? "google/gemini-3-flash-preview");

          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages }) => {
              // Persist any new messages (last user + assistant) for this thread.
              try {
                // Fetch ids we already have to avoid duplicates.
                const { data: existing } = await userClient
                  .from("messages")
                  .select("ai_sdk_id")
                  .eq("thread_id", threadId);
                const existingIds = new Set((existing ?? []).map((r) => r.ai_sdk_id).filter(Boolean));

                const toInsert = finalMessages
                  .filter((m) => !existingIds.has(m.id))
                  .map((m) => ({
                    thread_id: threadId,
                    user_id: userId,
                    role: m.role,
                    parts: m.parts as unknown as Record<string, unknown>[],
                    ai_sdk_id: m.id,
                  }));

                if (toInsert.length) {
                  await userClient.from("messages").insert(toInsert);
                }
                await userClient
                  .from("threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);

                // Auto-title brand-new threads from the first user message.
                if (thread && (thread as { title?: string }).title == null) {
                  // no-op; we'll auto-title below regardless when title is default
                }
                const firstUser = finalMessages.find((m) => m.role === "user");
                if (firstUser) {
                  const text = firstUser.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join(" ")
                    .trim();
                  if (text) {
                    const { data: t } = await userClient
                      .from("threads")
                      .select("title")
                      .eq("id", threadId)
                      .maybeSingle();
                    if (t?.title === "New conversation") {
                      const title = text.length > 60 ? text.slice(0, 57) + "…" : text;
                      await userClient.from("threads").update({ title }).eq("id", threadId);
                    }
                  }
                }
              } catch (err) {
                console.error("[chat] persist failed:", err);
              }
            },
          });
        } catch (err) {
          console.error("[chat] error:", err);
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
