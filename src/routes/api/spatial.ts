import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkingModel } from "@/lib/ai-provider.server";
import { generateText } from "ai";

const MODEL = "google/gemini-3.6-flash";

interface Body {
  action: "news" | "weather" | "brief" | "summarize" | "explain" | "search" | "model-spec";
  query?: string;
  topic?: string;
  text?: string;
  lat?: number;
  lon?: number;
  persona?: string;
}

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function fetchNews(topic?: string) {
  const q = topic?.trim();
  const url = q
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`
    : `https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ARIA" } });
  if (!res.ok) throw new Error(`news upstream ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, 18).map((m, i) => {
    const block = m[1];
    const pick = (tag: string) => {
      const r = block.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "s"));
      return r ? decodeEntities(r[1]) : "";
    };
    return {
      id: `n${i}`,
      title: pick("title"),
      link: (block.match(/<link>(.*?)<\/link>/s)?.[1] ?? "").trim(),
      source: pick("source"),
      published: pick("pubDate"),
      snippet: pick("description").slice(0, 260),
    };
  });
  return items.filter((i) => i.title);
}

async function fetchWeather(lat?: number, lon?: number) {
  const la = lat ?? 51.5072;
  const lo = lon ?? -0.1276;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather upstream ${res.status}`);
  return res.json();
}

async function ai(key: string, system: string, prompt: string) {
  const { text } = await generateText({
    model: (await resolveWorkingModel()).model,
    system,
    prompt,
  });
  return text;
}

export const Route = createFileRoute("/api/spatial")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        try {
          switch (body.action) {
            case "news": {
              const items = await fetchNews(body.topic);
              return Response.json({ items });
            }
            case "weather": {
              const data = await fetchWeather(body.lat, body.lon);
              return Response.json(data);
            }
            case "summarize": {
              const text = await ai(
                key,
                "You are ARIA. Summarise the article in 3 tight bullet points then one 'Why it matters' line. Plain text, no markdown headings.",
                `Headline: ${body.query ?? ""}\n\n${body.text ?? ""}`,
              );
              return Response.json({ text });
            }
            case "model-spec": {
              const q = (body.query ?? "").slice(0, 160);
              const raw = await ai(
                key,
                [
                  "You design simple 3D holographic models out of primitive shapes for an AR workspace.",
                  "Reply with ONLY minified JSON, no markdown fences, matching:",
                  '{"title":string,"subtitle":string,"spin":number,"parts":[{"name":string,"desc":string,"shape":"sphere"|"box"|"cylinder"|"cone"|"torus"|"capsule","size":[number,number,number],"pos":[number,number,number],"color":"#rrggbb","wireframe":boolean}]}',
                  "Rules: 4-10 parts. Coordinates and sizes between -2.5 and 2.5 in arbitrary units, assembled so the parts form a recognisable shape of the subject. Y is up. desc is one factual sentence about what that part does. subtitle is 3-5 words.",
                ].join("\n"),
                `Subject: ${q}`,
              );
              const cleaned = raw
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();
              const start = cleaned.indexOf("{");
              const end = cleaned.lastIndexOf("}");
              if (start < 0 || end <= start) return Response.json({ error: "bad spec" }, { status: 502 });
              try {
                const spec = JSON.parse(cleaned.slice(start, end + 1));
                if (!Array.isArray(spec?.parts) || spec.parts.length === 0) {
                  return Response.json({ error: "empty spec" }, { status: 502 });
                }
                return Response.json({ spec });
              } catch {
                return Response.json({ error: "unparsable spec" }, { status: 502 });
              }
            }
            case "explain": {

              const text = await ai(
                key,
                "You are ARIA, an expert spatial tutor. Explain the requested component clearly in 2-4 short sentences. Confident, specific, no filler.",
                body.query ?? "",
              );
              return Response.json({ text });
            }
            case "brief": {
              const text = await ai(
                key,
                "You are ARIA. Produce a compact, scannable briefing in plain text lines (no markdown). Max 10 lines. If you are unsure about live data, say so briefly rather than inventing specifics.",
                body.query ?? "",
              );
              return Response.json({ text });
            }
            case "search": {
              const q = body.query ?? "";
              let snippets = "";
              try {
                const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
                  headers: { "User-Agent": "Mozilla/5.0 ARIA" },
                });
                const html = await r.text();
                snippets = [...html.matchAll(/<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/gs)]
                  .slice(0, 8)
                  .map((m) => decodeEntities(m[1]))
                  .join("\n");
              } catch {
                snippets = "";
              }
              const text = await ai(
                key,
                "You are ARIA's web research module. Answer the query directly in under 120 words using the result titles as signal. Flag uncertainty rather than inventing facts.",
                `Query: ${q}\n\nResult titles:\n${snippets}`,
              );
              return Response.json({ text, snippets: snippets.split("\n").filter(Boolean) });
            }
            default:
              return new Response("Unknown action", { status: 400 });
          }
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
        }
      },
    },
  },
});
