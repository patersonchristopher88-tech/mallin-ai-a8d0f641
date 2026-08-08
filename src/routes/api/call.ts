import { createFileRoute } from "@tanstack/react-router";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { resolveWorkingModel } from "@/lib/ai-provider.server";
import { buildSystemPrompt, type PersonaKey } from "@/lib/aria/personas";

type Turn = { role: "user" | "assistant"; content: string };

type CallBody = {
  messages?: Turn[];
  mode?: "reply" | "summary";
  visionNote?: string | null;
};

const SummarySchema = z.object({
  topics: z.array(z.string()).max(8),
  actions: z.array(z.string()).max(8),
  reminders: z.array(z.string()).max(8),
  memories: z.array(z.string()).max(8),
  headline: z.string(),
});

export const Route = createFileRoute("/api/call")({
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

          const body = (await request.json()) as CallBody;
          const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
          if (messages.length === 0) return new Response("Bad request", { status: 400 });

          const [{ data: profile }, { data: memories }] = await Promise.all([
            userClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
            userClient
              .from("memories")
              .select("content")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(24),
          ]);

          const resolved = await resolveWorkingModel();
          const gateway = (_id?: string) => resolved.model;
          const model = gateway("google/gemini-3.6-flash");

          if (body.mode === "summary") {
            const transcript = messages
              .map((m) => `${m.role === "user" ? "User" : "ARIA"}: ${m.content}`)
              .join("\n");
            const { object } = await generateObject({
              model,
              schema: SummarySchema,
              prompt: `Summarise this voice call between a user and their AI assistant. Be concise and specific; use empty arrays when nothing applies. "memories" should list durable facts worth remembering about the user.\n\n${transcript}`,
            });
            return Response.json(object);
          }

          const persona = (profile?.persona ?? "jarvis") as PersonaKey;
          const base = buildSystemPrompt({
            persona,
            customPrompt: profile?.system_prompt ?? null,
            assistantName: profile?.assistant_name ?? "ARIA",
            userName: profile?.display_name ?? null,
            verbosity: Math.min(profile?.verbosity ?? 50, 35),
            formality: profile?.formality ?? 50,
            memories: (memories ?? []).map((m) => m.content),
          });

          const callRules = [
            "You are currently on a live VOICE CALL. Everything you say is spoken aloud.",
            "Speak in natural spoken language: short sentences, no markdown, no bullet points, no emoji, no code blocks, no headings.",
            "Keep replies to roughly 1-3 sentences unless the user explicitly asks for detail.",
            "Be calm, intelligent, warm, confident and lightly witty. Emotionally aware, never robotic, never generic.",
            "When it fits naturally, reference something you remember about the user instead of restating it as a list.",
            "If speech seems garbled, ask a brief clarifying question rather than guessing.",
            body.visionNote
              ? `Live camera feed context (what you can currently see): ${body.visionNote}. Use it naturally when relevant.`
              : "",
          ]
            .filter(Boolean)
            .join(" ");

          const { text } = await generateText({
            model,
            system: `${base}\n\n${callRules}`,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });

          return Response.json({ text: text.trim() });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
