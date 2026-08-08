import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  generateObject,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { resolveWorkingModel, AiCreditsExhaustedError } from "@/lib/ai-provider.server";
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

          const { data: thread } = await userClient
            .from("threads")
            .select("id, user_id, persona, title")
            .eq("id", threadId)
            .maybeSingle();
          if (!thread || thread.user_id !== userId) {
            return new Response("Thread not found", { status: 404 });
          }

          const [{ data: profile }, { data: memories }] = await Promise.all([
            userClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
            userClient
              .from("memories")
              .select("content")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(30),
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

          const resolved = await resolveWorkingModel();
          const gateway = (_id?: string) => resolved.model;
          const model = resolved.model;

          // ==================== AGENT TOOLS ====================
          const tools = {
            get_current_time: tool({
              description:
                "Get the current date and time in the user's timezone. Use when asked about time, date, day of week.",
              inputSchema: z.object({}),
              execute: async () => {
                const tz = profile?.timezone ?? "UTC";
                const now = new Date();
                return {
                  iso: now.toISOString(),
                  local: now.toLocaleString("en-US", { timeZone: tz }),
                  timezone: tz,
                };
              },
            }),
            remember_fact: tool({
              description:
                "Save a durable fact about the user for future conversations (preferences, personal details, goals, context). Only save meaningful, long-term facts.",
              inputSchema: z.object({
                fact: z.string().describe("A concise first-person fact, e.g. 'User is a pilot based in Miami.'"),
                kind: z
                  .enum(["preference", "personal", "goal", "context", "fact"])
                  .describe("Category of the memory"),
              }),
              execute: async ({ fact, kind }) => {
                const { error } = await userClient.from("memories").insert({
                  user_id: userId,
                  content: fact,
                  kind,
                  source_thread_id: threadId,
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, saved: fact };
              },
            }),
            set_reminder: tool({
              description:
                "Schedule a reminder for the user. due_at must be an ISO 8601 timestamp in the future.",
              inputSchema: z.object({
                text: z.string().describe("What to remind the user about"),
                due_at: z.string().describe("ISO 8601 timestamp when the reminder should fire"),
              }),
              execute: async ({ text, due_at }) => {
                const d = new Date(due_at);
                if (isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
                const { error } = await userClient.from("reminders").insert({
                  user_id: userId,
                  text,
                  due_at: d.toISOString(),
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, text, due_at: d.toISOString() };
              },
            }),
            search_web: tool({
              description:
                "Search the public web for current information. Use for news, facts, or anything after your training cutoff.",
              inputSchema: z.object({
                query: z.string().describe("Search query"),
              }),
              execute: async ({ query }) => {
                try {
                  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
                  const r = await fetch(url, { headers: { "User-Agent": "ARIA/1.0" } });
                  const j = (await r.json()) as {
                    AbstractText?: string;
                    AbstractURL?: string;
                    Heading?: string;
                    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
                  };
                  const results: Array<{ title: string; url: string; snippet: string }> = [];
                  if (j.AbstractText) {
                    results.push({
                      title: j.Heading ?? query,
                      url: j.AbstractURL ?? "",
                      snippet: j.AbstractText,
                    });
                  }
                  for (const t of (j.RelatedTopics ?? []).slice(0, 6)) {
                    if (t.Text && t.FirstURL) {
                      results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
                    }
                  }
                  return { query, results: results.slice(0, 8) };
                } catch (e) {
                  return { query, error: e instanceof Error ? e.message : "Search failed", results: [] };
                }
              },
            }),
            list_reminders: tool({
              description: "List the user's upcoming reminders.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await userClient
                  .from("reminders")
                  .select("text, due_at, done")
                  .eq("done", false)
                  .order("due_at", { ascending: true })
                  .limit(10);
                return { reminders: data ?? [] };
              },
            }),
          };

          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            tools,
            stopWhen: stepCountIs(8),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages }) => {
              try {
                const { data: existing } = await userClient
                  .from("messages")
                  .select("ai_sdk_id")
                  .eq("thread_id", threadId);
                const existingIds = new Set(
                  (existing ?? []).map((r) => r.ai_sdk_id).filter(Boolean),
                );

                const toInsert = finalMessages
                  // Skip messages without a stable id — they'd be re-inserted
                  // every turn and duplicate the thread.
                  .filter((m) => m.id && !existingIds.has(m.id))
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

                // ============ AUTO MEMORY EXTRACTION ============
                // Run silently on user turns; extract 0-3 durable facts.
                const lastUser = [...finalMessages].reverse().find((m) => m.role === "user");
                if (lastUser) {
                  const userText = lastUser.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join(" ")
                    .trim();
                  if (userText.length > 30) {
                    try {
                      const { object } = await generateObject({
                        model: gateway("google/gemini-3-flash-preview"),
                        schema: z.object({
                          memories: z.array(
                            z.object({
                              fact: z.string(),
                              kind: z.enum([
                                "preference",
                                "personal",
                                "goal",
                                "context",
                                "fact",
                              ]),
                            }),
                          ),
                        }),
                        prompt: `From this user message, extract 0 to 3 durable facts worth remembering for future conversations. Only extract clear, first-person, long-term facts (preferences, goals, personal details, context). Skip greetings, questions, transient statements, or anything trivial. Return an empty array if nothing qualifies.\n\nMessage: """${userText.slice(0, 2000)}"""`,
                      });
                      if (object.memories.length) {
                        // Dedupe against existing memory contents (case-insensitive fuzzy).
                        const { data: existingMem } = await userClient
                          .from("memories")
                          .select("content")
                          .eq("user_id", userId)
                          .limit(200);
                        const known = new Set(
                          (existingMem ?? []).map((m) =>
                            m.content.toLowerCase().replace(/[^a-z0-9]+/g, ""),
                          ),
                        );
                        const toSave = object.memories
                          .filter((m) => {
                            const key = m.fact.toLowerCase().replace(/[^a-z0-9]+/g, "");
                            return key.length > 5 && !known.has(key);
                          })
                          .map((m) => ({
                            user_id: userId,
                            content: m.fact,
                            kind: m.kind,
                            source_thread_id: threadId,
                          }));
                        if (toSave.length) {
                          await userClient.from("memories").insert(toSave);
                        }
                      }
                    } catch (memErr) {
                      console.warn("[chat] memory extract failed:", memErr);
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
