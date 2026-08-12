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

function getOllamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1";
}

function getOllamaModel() {
  return process.env.OLLAMA_MODEL || "llama3.2";
}

function getClaudeModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;

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

function getOllamaClient() {
  if (!ollamaClient) {
    ollamaClient = new OpenAI({
      apiKey: process.env.OLLAMA_API_KEY?.trim() || "ollama",
      baseURL: getOllamaBaseUrl(),
    });
  }
  return ollamaClient;
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
    max_tokens: 2048,
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

  return { content, provider: "claude" };
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

  return { content, provider: "openai" };
}

async function chatWithOllama(messages: AiMessage[]): Promise<AiChatResult> {
  const completion = await getOllamaClient().chat.completions.create({
    model: getOllamaModel(),
    // Many local models honor JSON better via prompt than response_format.
    messages,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new AppError("AI_FAILURE", "Ollama did not return content.", 502);
  }

  return { content, provider: "ollama" };
}

function resolveOrder(): AiProvider[] {
  const preference = getProviderPreference();
  if (preference === "ollama") return hasOllama() ? ["ollama"] : [];
  if (preference === "claude") return hasClaude() ? ["claude"] : [];
  if (preference === "openai") return hasOpenAI() ? ["openai"] : [];

  // auto: Ollama primary, Anthropic secondary, OpenAI tertiary
  const order: AiProvider[] = [];
  if (hasOllama()) order.push("ollama");
  if (hasClaude()) order.push("claude");
  if (hasOpenAI()) order.push("openai");
  return order;
}

/**
 * Chat completion with Ollama primary, then Anthropic, then OpenAI (when AI_PROVIDER=auto).
 */
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
      console.error(`[ai] ${provider} failed, trying next provider if available.`, error);
      // Only fall through when preference is auto and another provider remains.
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
