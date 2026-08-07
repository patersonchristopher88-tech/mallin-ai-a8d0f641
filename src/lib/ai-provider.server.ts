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
