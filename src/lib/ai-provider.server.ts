import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { LanguageModel } from "ai";

/**
 * Single AI provider resolver for ARIA's backend.
 *
 * Priority:
 *  1. Ollama Cloud (OLLAMA_API_KEY) — the user's own account, OpenAI-compatible API.
 *  2. Lovable AI Gateway (LOVABLE_API_KEY) as fallback.
 */

export type AiProviderName = "ollama" | "lovable";

const OLLAMA_BASE_URL = "https://ollama.com/v1";
const OLLAMA_TEXT_DEFAULT = "gpt-oss:20b";
const OLLAMA_SMART_DEFAULT = "gpt-oss:120b";
const OLLAMA_VISION_DEFAULT = "gemma4:31b";
const GATEWAY_TEXT_DEFAULT = "google/gemini-3.6-flash";

export function activeProvider(): AiProviderName {
  return process.env.OLLAMA_API_KEY ? "ollama" : "lovable";
}

function ollamaModelId(opts?: { smart?: boolean; vision?: boolean }): string {
  if (opts?.vision) return process.env.OLLAMA_VISION_MODEL ?? OLLAMA_VISION_DEFAULT;
  if (opts?.smart) return process.env.OLLAMA_SMART_MODEL ?? OLLAMA_SMART_DEFAULT;
  return process.env.OLLAMA_TEXT_MODEL ?? OLLAMA_TEXT_DEFAULT;
}

function ollamaProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "ollama",
    baseURL: OLLAMA_BASE_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/** Text/vision model for the AI SDK (generateText / generateObject / streamText). */
export function resolveModel(opts?: { smart?: boolean; vision?: boolean }): {
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
} {
  const ollamaKey = process.env.OLLAMA_API_KEY;
  if (ollamaKey) {
    const modelId = ollamaModelId(opts);
    return { model: ollamaProvider(ollamaKey)(modelId), provider: "ollama", modelId };
  }
  return gatewayModel();
}

/** Lovable gateway model, ignoring any personal provider key. */
function gatewayModel(): { model: LanguageModel; provider: AiProviderName; modelId: string } {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No AI provider configured (set OLLAMA_API_KEY)");
  const gateway = createLovableAiGatewayProvider(key);
  return { model: gateway(GATEWAY_TEXT_DEFAULT), provider: "lovable", modelId: GATEWAY_TEXT_DEFAULT };
}

export class AiCreditsExhaustedError extends Error {
  constructor() {
    super(
      "AI is unavailable. Your Ollama account and the built-in AI both refused the request (no access or no credits) — check your Ollama plan and try again.",
    );
    this.name = "AiCreditsExhaustedError";
  }
}

// Short-lived health cache so we don't preflight on every message.
const health = new Map<string, { ok: boolean; at: number }>();
const HEALTH_TTL = 60_000;

async function providerHealthy(
  p: AiProviderName,
  opts?: { smart?: boolean; vision?: boolean },
): Promise<boolean> {
  const ep = chatEndpointFor(p, opts);
  const cacheKey = `${p}:${ep.model}`;
  const cached = health.get(cacheKey);
  if (cached && Date.now() - cached.at < HEALTH_TTL) return cached.ok;
  let ok = false;
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers,
      body: JSON.stringify({
        model: ep.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    // Only auth / billing / plan failures disqualify a provider.
    ok = ![401, 402, 403, 429].includes(res.status);
    void res.body?.cancel();
  } catch {
    ok = false;
  }
  health.set(cacheKey, { ok, at: Date.now() });
  return ok;
}

/**
 * Like resolveModel(), but preflights the provider and falls back to the other
 * one when the primary is unavailable.
 */
export async function resolveWorkingModel(opts?: { smart?: boolean; vision?: boolean }): Promise<{
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
}> {
  const order: AiProviderName[] = ["ollama", "lovable"];
  for (const p of order) {
    if (p === "ollama" && !process.env.OLLAMA_API_KEY) continue;
    if (p === "lovable" && !process.env.LOVABLE_API_KEY) continue;
    if (await providerHealthy(p, opts)) {
      return p === "ollama" ? resolveModel(opts) : gatewayModel();
    }
  }
  throw new AiCreditsExhaustedError();
}

function chatEndpointFor(
  p: AiProviderName,
  opts?: { smart?: boolean; vision?: boolean },
): { url: string; headers: Record<string, string>; model: string; provider: AiProviderName } {
  if (p === "ollama") {
    return {
      url: `${OLLAMA_BASE_URL}/chat/completions`,
      headers: {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      model: ollamaModelId(opts),
      provider: "ollama",
    };
  }
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    model: GATEWAY_TEXT_DEFAULT,
    provider: "lovable",
  };
}

/** Raw OpenAI-compatible chat-completions target, for hand-rolled fetch calls (vision frames etc). */
export function resolveChatEndpoint(opts?: { smart?: boolean; vision?: boolean }): {
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: AiProviderName;
} {
  if (process.env.OLLAMA_API_KEY) return chatEndpointFor("ollama", opts);
  if (process.env.LOVABLE_API_KEY) return chatEndpointFor("lovable", opts);
  throw new Error("No AI provider configured (set OLLAMA_API_KEY)");
}

/** Convenience: single-shot chat completion through whichever provider is active. */
export async function chatOnce(
  messages: unknown[],
  opts?: { smart?: boolean; vision?: boolean; maxTokens?: number },
): Promise<string> {
  const candidates: AiProviderName[] = [];
  if (process.env.OLLAMA_API_KEY) candidates.push("ollama");
  if (process.env.LOVABLE_API_KEY) candidates.push("lovable");
  if (!candidates.length) throw new Error("No AI provider configured (set OLLAMA_API_KEY)");

  let lastErr = "";
  for (const p of candidates) {
    const ep = chatEndpointFor(p, opts);
    const res = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers,
      body: JSON.stringify({
        model: ep.model,
        messages,
        ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    }
    lastErr = `${ep.provider} chat failed [${res.status}]: ${await res.text()}`;
    // Auth/plan/credit failures -> try the next provider; anything else is fatal.
    if (![401, 402, 403, 429].includes(res.status)) throw new Error(lastErr);
  }
  throw new Error(lastErr);
}
