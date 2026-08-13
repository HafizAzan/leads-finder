import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AppError } from "@/lib/api/errors";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProvider = "ollama" | "claude" | "openai";

export type AiChatResult = {
  content: string;
  provider: AiProvider;
};

type ProviderPreference = "auto" | "ollama" | "claude" | "openai";

function getProviderPreference(): ProviderPreference {
  const value = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (value === "ollama" || value === "claude" || value === "openai" || value === "auto") {
    return value;
  }
  return "auto";
}

function hasOllama() {
  return Boolean(process.env.OLLAMA_BASE_URL?.trim());
}

function hasClaude() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** OpenAI-compatible base (…/v1) */
function getOllamaOpenAiBaseUrl() {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1";
}

/** Native Ollama host (no /v1) */
function getOllamaNativeBaseUrl() {
  return getOllamaOpenAiBaseUrl().replace(/\/v1\/?$/, "");
}

function getOllamaModel() {
  return process.env.OLLAMA_MODEL || "qwen3:4b";
}

function getClaudeModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

async function chatWithClaude(messages: AiMessage[]): Promise<AiChatResult> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const response = await getAnthropicClient().messages.create({
    model: getClaudeModel(),
    max_tokens: 1024,
    system: system || undefined,
    messages: conversation,
  });

  const content = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  if (!content) {
    throw new AppError("AI_FAILURE", "Claude did not return content.", 502);
  }

  return { content: cleanAiJsonContent(content), provider: "claude" };
}

async function chatWithOpenAI(messages: AiMessage[]): Promise<AiChatResult> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: getOpenAIModel(),
    response_format: { type: "json_object" },
    messages,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new AppError("AI_FAILURE", "OpenAI did not return content.", 502);
  }

  return { content: cleanAiJsonContent(content), provider: "openai" };
}

/**
 * Native Ollama /api/chat — supports think:false (critical for qwen3 speed).
 */
async function chatWithOllama(messages: AiMessage[]): Promise<AiChatResult> {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 25000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getOllamaNativeBaseUrl()}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOllamaModel(),
        stream: false,
        think: false,
        format: "json",
        options: {
          temperature: 0.2,
          num_predict: 500,
        },
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      message?: { content?: string };
      error?: string;
    };

    if (!response.ok) {
      throw new AppError(
        "AI_FAILURE",
        json.error || `Ollama request failed (${response.status}). Is the model pulled?`,
        502,
      );
    }

    const raw = json.message?.content?.trim() || "";
    const content = cleanAiJsonContent(raw);
    if (!content) {
      throw new AppError("AI_FAILURE", "Ollama did not return content.", 502);
    }

    return { content, provider: "ollama" };
  } catch (error) {
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    const aborted =
      (error instanceof Error && error.name === "AbortError") || /aborted|abort|timeout/i.test(message);

    if (aborted) {
      throw new AppError(
        "AI_FAILURE",
        `Ollama timed out after ${Math.round(timeoutMs / 1000)}s. Try a faster model (e.g. llama3.2) or set OPENAI_API_KEY.`,
        504,
      );
    }

    throw new AppError(
      "AI_FAILURE",
      message.includes("fetch failed") || message.includes("ECONNREFUSED")
        ? "Cannot reach Ollama. Is `ollama serve` running on localhost:11434?"
        : message,
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function cleanAiJsonContent(raw: string) {
  let text = raw.trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

function resolveOrder(): AiProvider[] {
  const preference = getProviderPreference();
  if (preference === "ollama") return hasOllama() ? ["ollama"] : [];
  if (preference === "claude") return hasClaude() ? ["claude"] : [];
  if (preference === "openai") return hasOpenAI() ? ["openai"] : [];

  const order: AiProvider[] = [];
  if (hasOllama()) order.push("ollama");
  if (hasClaude()) order.push("claude");
  if (hasOpenAI()) order.push("openai");
  return order;
}

export async function aiChat(messages: AiMessage[]): Promise<AiChatResult> {
  const order = resolveOrder();

  if (order.length === 0) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "No AI provider configured. Set OLLAMA_BASE_URL (primary), and/or ANTHROPIC_API_KEY, and/or OPENAI_API_KEY.",
      500,
    );
  }

  let lastError: unknown;

  for (const provider of order) {
    try {
      if (provider === "ollama") return await chatWithOllama(messages);
      if (provider === "claude") return await chatWithClaude(messages);
      return await chatWithOpenAI(messages);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = /timed out|aborted/i.test(message);
      if (isTimeout) {
        console.warn(`[ai] ${provider} timed out, trying next provider if available.`);
      } else {
        console.error(`[ai] ${provider} failed, trying next provider if available.`, error);
      }
      if (getProviderPreference() !== "auto" || order[order.length - 1] === provider) {
        break;
      }
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw new AppError(
    "AI_FAILURE",
    lastError instanceof Error ? lastError.message : "All AI providers failed.",
    502,
  );
}
