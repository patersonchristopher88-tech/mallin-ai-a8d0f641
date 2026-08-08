import { createFileRoute } from "@tanstack/react-router";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { resolveWorkingModel } from "@/lib/ai-provider.server";

// Generic streaming endpoint powering every text-based Studio tool.
// Body: { toolId, textPreset?, input: Record<string,string>, prompt: string }

const SYSTEM_PROMPTS: Record<string, string> = {
  chat:
    "You are ARIA, a witty, helpful, precise AI assistant. Answer clearly in markdown.",
  "essay-writer":
    "You are a professional essayist. Write a well-structured essay with a clear thesis, 3-5 body paragraphs each with evidence, and a strong conclusion. Use markdown headings. Respect the requested word count.",
  "story-writer":
    "You are a literary short-fiction author. Write an original, vivid short story with a strong voice, sensory detail, and a satisfying arc. Markdown only for emphasis; no headings.",
  "script-writer":
    "You are a screenwriter. Output correctly formatted screenplay: scene headings (INT./EXT.), action lines in present tense, character names in CAPS above dialogue, parentheticals sparingly. Use a code block for the script.",
  "email-writer":
    "You are an executive communications writer. Produce a subject line and a single email body matching the requested tone. Concise, no filler, correct salutation and sign-off.",
  "resume-builder":
    "You are an expert résumé writer. Produce an ATS-friendly one-page résumé in clean markdown with sections: Summary, Experience (STAR-style bullets with metrics), Skills, Education. No fluff.",
  "social-generator":
    "You are a top-performing social copywriter. For the target platform produce THREE distinct post variants (A, B, C), each with a strong hook, natural voice, platform-appropriate length, and a call to action. Include hashtags only where the platform expects them.",
  "code-assistant":
    "You are a senior software engineer. Answer with correct, production-ready code in the appropriate language, wrapped in fenced code blocks with language tags. Explain briefly BELOW the code, not before.",
  "website-builder":
    "You are a senior web engineer. Produce a complete, self-contained index.html file (with inline CSS and JS if needed) that solves the brief. Wrap the file in a ```html fenced block. Follow with a short usage note.",
  "app-builder":
    "You are a product-minded senior mobile engineer. Produce: 1) core feature list, 2) suggested tech stack, 3) data model, 4) 3-screen wireframe description, 5) week-by-week 4-week build plan. Use markdown headings.",
  debugger:
    "You are a senior debugger. Diagnose the error step by step: 1) what the error means, 2) most likely root cause given the code, 3) minimal patch (in a fenced code block), 4) how to verify. Be specific.",
  "api-helper":
    "You are an API expert. Provide: a curl example and a fetch/JavaScript example in fenced code blocks, then a short table of the important parameters and their meaning.",
  "brand-kit":
    "You are a brand strategist. Deliver a full brand kit in markdown: 1) Brand personality (5 adjectives), 2) Tone-of-voice do/don't, 3) Color palette with hex codes + usage, 4) Typography pairing (heading + body font recommendations), 5) Tagline options (3).",
  "pdf-chat":
    "You are analysing a document the user pasted. Ground every claim in the pasted text; if the answer isn't in the text, say so.",
  "presentation-creator":
    "You are a keynote-caliber deck builder. Produce a slide-by-slide outline. For each slide: `## Slide N — Title`, then bullet points and a one-line speaker note.",
  "document-summariser":
    "You are a rigorous summariser. Produce: 1) 3-sentence TL;DR, 2) 5-8 key bullet points, 3) any action items. No hallucination — stick to the source.",
  notes:
    "You are a personal knowledge assistant. Organise the user's messy input into clean structured notes with headings, bullets, and clear next actions.",
  "research-assistant":
    "You are a research analyst. Use the `search_web` tool to gather 2-4 authoritative sources, then synthesise a grounded answer with an inline `[n]` citation style and a numbered Sources list at the bottom linking to the URLs.",
  mindmap:
    "You are a mind-map generator. Return an indented markdown outline representing a mind map, 3-4 levels deep, with 3-6 branches per node. Wrap it in a fenced code block.",
  "video-editor":
    "You are a senior video editor. Produce an actionable edit plan: 1) narrative structure, 2) shot-by-shot cut list with timecodes if provided, 3) transitions & pacing notes, 4) music & sound suggestions, 5) color/grade direction.",
  "video-enhancer":
    "You are a post-production supervisor. Produce a concrete enhancement recipe: denoise, sharpening, color grading, stabilisation, and any resolution / frame-rate work. Recommend specific tools (DaVinci Resolve nodes, Topaz, FFmpeg commands) and settings.",
  "shorts-creator":
    "You are a viral short-form video producer. Output 3 distinct short-video scripts (30-60s each). For each: hook line (< 3s), beat-by-beat script, on-screen text cues, and CTA. Optimise for TikTok/Reels/Shorts.",
  "music-generator":
    "You are a music producer. Produce a full composition brief: genre & mood, tempo (BPM), key, song structure (intro / verse / chorus / bridge / outro with bar counts), instrument list per section, lyrical theme if vocal, and reference tracks.",
  "voice-cloning":
    "You are a voice-tech guide. Walk the user through cloning their voice with ElevenLabs Instant Voice Clone: sample requirements, recording tips, ethical considerations, and how to use the resulting voice in ARIA's TTS.",
  "podcast-generator":
    "You are a podcast writer. Deliver a full episode script: cold open, intro, chaptered discussion segments with host cues, ad-break placements, and outro. Include suggested guest questions if two hosts.",
  "audio-cleaner":
    "You are an audio engineer. Give a concrete cleanup recipe: which noise-reduction tool + settings (Adobe Audition, iZotope RX, Audacity), EQ curves, de-reverb, compression, and final loudness target (e.g. -16 LUFS for podcast).",
};

export const Route = createFileRoute("/api/text-tool")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const body = (await request.json()) as {
            toolId: string;
            textPreset?: string;
            prompt: string;
            input?: Record<string, string>;
          };
          if (!body.prompt) return new Response("Missing prompt", { status: 400 });

          const presetKey = body.textPreset ?? body.toolId;
          const system = SYSTEM_PROMPTS[presetKey] ?? SYSTEM_PROMPTS.chat;

          const resolved = await resolveWorkingModel();
          const gateway = (_id?: string) => resolved.model;
          const model = gateway("google/gemini-3-flash-preview");

          // Compose user message from prompt + any structured fields (tone, length, etc.).
          const extras = Object.entries(body.input ?? {})
            .filter(([k, v]) => k !== "prompt" && v)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
          const userMessage = extras ? `${body.prompt}\n\n---\n${extras}` : body.prompt;

          // Only the research assistant gets the web-search tool.
          const useSearch = presetKey === "research-assistant";
          const tools = useSearch
            ? {
                search_web: tool({
                  description: "Search the public web for authoritative sources.",
                  inputSchema: z.object({ query: z.string() }),
                  execute: async ({ query }) => {
                    try {
                      const r = await fetch(
                        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
                        { headers: { "User-Agent": "ARIA/1.0" } },
                      );
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
              }
            : undefined;

          const result = streamText({
            model,
            system,
            prompt: userMessage,
            tools,
            stopWhen: stepCountIs(6),
          });

          return result.toTextStreamResponse();
        } catch (err) {
          console.error("[text-tool] error:", err);
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
