import { createOpenAI } from "@ai-sdk/openai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { LanguageModel } from "ai";

/**
 * Single AI provider resolver for ARIA's backend.
 *
 * Priority:
 *  1. The user's own OpenAI key (OPENAI_API_KEY) — billed to their account,
 *     so ARIA keeps working when the shared workspace balance is empty.
 *  2. Lovable AI Gateway (LOVABLE_API_KEY) as fallback.
 */

export type AiProviderName = "openai" | "lovable";

const OPENAI_TEXT_DEFAULT = "gpt-4.1-mini";
const OPENAI_SMART_DEFAULT = "gpt-4.1";
const GATEWAY_TEXT_DEFAULT = "google/gemini-3.6-flash";

export function activeProvider(): AiProviderName {
  return process.env.OPENAI_API_KEY ? "openai" : "lovable";
}

/** Text/vision model for the AI SDK (generateText / generateObject / streamText). */
export function resolveModel(opts?: { smart?: boolean }): {
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
} {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    const modelId =
      process.env[opts?.smart ? "OPENAI_SMART_MODEL" : "OPENAI_TEXT_MODEL"] ??
      (opts?.smart ? OPENAI_SMART_DEFAULT : OPENAI_TEXT_DEFAULT);
    return { model: openai(modelId), provider: "openai", modelId };
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No AI provider configured (set OPENAI_API_KEY)");
  const gateway = createLovableAiGatewayProvider(key);
  return { model: gateway(GATEWAY_TEXT_DEFAULT), provider: "lovable", modelId: GATEWAY_TEXT_DEFAULT };
}

/** Lovable gateway model, ignoring any personal OpenAI key. */
function gatewayModel(): { model: LanguageModel; provider: AiProviderName; modelId: string } {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No AI provider configured");
  const gateway = createLovableAiGatewayProvider(key);
  return { model: gateway(GATEWAY_TEXT_DEFAULT), provider: "lovable", modelId: GATEWAY_TEXT_DEFAULT };
}

export class AiCreditsExhaustedError extends Error {
  constructor() {
    super(
      "AI is out of credits. Your personal OpenAI key and the built-in AI both report no remaining balance — top up either one and chat will work again.",
    );
    this.name = "AiCreditsExhaustedError";
  }
}

// Short-lived health cache so we don't preflight on every message.
const health = new Map<AiProviderName, { ok: boolean; at: number }>();
const HEALTH_TTL = 60_000;

async function providerHealthy(p: AiProviderName, smart?: boolean): Promise<boolean> {
  const cached = health.get(p);
  if (cached && Date.now() - cached.at < HEALTH_TTL) return cached.ok;
  let ok = false;
  try {
    const ep =
      p === "openai"
        ? {
            url: "https://api.openai.com/v1/chat/completions",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            model:
              process.env[smart ? "OPENAI_SMART_MODEL" : "OPENAI_TEXT_MODEL"] ??
              (smart ? OPENAI_SMART_DEFAULT : OPENAI_TEXT_DEFAULT),
          }
        : {
            url: "https://ai.gateway.lovable.dev/v1/chat/completions",
            headers: {
              Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            model: GATEWAY_TEXT_DEFAULT,
          };
    const res = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers,
      body: JSON.stringify({
        model: ep.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    // Only billing/auth failures disqualify a provider.
    ok = res.status !== 401 && res.status !== 402 && res.status !== 429;
    void res.body?.cancel();
  } catch {
    ok = false;
  }
  health.set(p, { ok, at: Date.now() });
  return ok;
}

/**
 * Like resolveModel(), but preflights the provider and falls back to the other
 * one when the primary has no credits / bad auth.
 */
export async function resolveWorkingModel(opts?: { smart?: boolean }): Promise<{
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
}> {
  const order: AiProviderName[] = process.env.OPENAI_API_KEY
    ? ["openai", "lovable"]
    : ["lovable", "openai"];
  for (const p of order) {
    if (p === "openai" && !process.env.OPENAI_API_KEY) continue;
    if (p === "lovable" && !process.env.LOVABLE_API_KEY) continue;
    if (await providerHealthy(p, opts?.smart)) {
      return p === "openai" ? resolveModel(opts) : gatewayModel();
    }
  }
  throw new AiCreditsExhaustedError();
}

/** Raw OpenAI-compatible chat-completions target, for hand-rolled fetch calls (vision frames etc). */
export function resolveChatEndpoint(opts?: { smart?: boolean }): {
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: AiProviderName;
} {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      model:
        process.env[opts?.smart ? "OPENAI_SMART_MODEL" : "OPENAI_TEXT_MODEL"] ??
        (opts?.smart ? OPENAI_SMART_DEFAULT : OPENAI_TEXT_DEFAULT),
      provider: "openai",
    };
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No AI provider configured (set OPENAI_API_KEY)");
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    model: GATEWAY_TEXT_DEFAULT,
    provider: "lovable",
  };
}

/** Convenience: single-shot chat completion through whichever provider is active. */
export async function chatOnce(
  messages: unknown[],
  opts?: { smart?: boolean; maxTokens?: number },
): Promise<string> {
  const ep = resolveChatEndpoint(opts);
  const res = await fetch(ep.url, {
    method: "POST",
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      messages,
      ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${ep.provider} chat failed [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
