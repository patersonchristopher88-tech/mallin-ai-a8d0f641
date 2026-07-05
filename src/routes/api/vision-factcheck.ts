import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// Fact-check a vision-scan claim. Searches DuckDuckGo + Wikipedia,
// then asks the model to cross-reference and score confidence.
// Body: { claim: string }
// Returns: { verdict, confidence, reasoning, sources[] }

async function ddg(q: string) {
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
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
        title: j.Heading ?? q,
        url: j.AbstractURL ?? "",
        snippet: j.AbstractText,
      });
    }
    for (const t of (j.RelatedTopics ?? []).slice(0, 5)) {
      if (t.Text && t.FirstURL) {
        results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function wiki(q: string) {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g, "_"))}`,
      { headers: { "User-Agent": "ARIA/1.0" } },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    if (!j.extract) return [];
    return [
      {
        title: j.title ?? q,
        url: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
        snippet: j.extract,
      },
    ];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/vision-factcheck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const { claim } = (await request.json()) as { claim: string };
          if (!claim || claim.length < 3) return new Response("Missing claim", { status: 400 });

          // Gather sources in parallel.
          const [ddgResults, wikiResults] = await Promise.all([ddg(claim), wiki(claim)]);
          const sources = [...wikiResults, ...ddgResults].slice(0, 8);

          const gateway = createLovableAiGatewayProvider(key);
          const { object } = await generateObject({
            model: gateway("google/gemini-3-flash-preview"),
            schema: z.object({
              verdict: z.enum(["supported", "mixed", "unsupported", "unknown"]),
              confidence: z.number(),
              reasoning: z.string(),
              flagged_misinformation: z.boolean(),
            }),
            prompt: `Claim from a live camera scan: "${claim}"\n\nCross-reference the following web sources and judge the claim.\n\n${sources
              .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\n${s.url}`)
              .join("\n\n")}\n\nRules:\n- "supported" = clearly backed by sources.\n- "mixed" = partially true or context-dependent.\n- "unsupported" = contradicted by sources.\n- "unknown" = no relevant source.\n- confidence is 0..1.\n- flag misinformation only if unsupported AND likely to mislead.`,
          });

          return Response.json({ ...object, sources });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
