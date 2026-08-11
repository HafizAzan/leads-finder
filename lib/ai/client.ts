import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AppError } from "@/lib/api/errors";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatResult = {
  content: string;
  provider: "claude" | "openai";
};

type ProviderPreference = "auto" | "claude" | "openai";

function getProviderPreference(): ProviderPreference {
  const value = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (value === "claude" || value === "openai" || value === "auto") return value;
  return "auto";
}

function hasClaude() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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

function resolveOrder(): Array<"claude" | "openai"> {
  const preference = getProviderPreference();
  if (preference === "claude") return ["claude"];
  if (preference === "openai") return ["openai"];

  // auto: Claude primary, OpenAI secondary
  const order: Array<"claude" | "openai"> = [];
  if (hasClaude()) order.push("claude");
  if (hasOpenAI()) order.push("openai");
  return order;
}

/**
 * Chat completion with Claude as primary and OpenAI as fallback (when AI_PROVIDER=auto).
 */
export async function aiChat(messages: AiMessage[]): Promise<AiChatResult> {
  const order = resolveOrder();

  if (order.length === 0) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "No AI provider configured. Set ANTHROPIC_API_KEY (primary) and/or OPENAI_API_KEY (secondary).",
      500,
    );
  }

  let lastError: unknown;

  for (const provider of order) {
    try {
      if (provider === "claude") return await chatWithClaude(messages);
      return await chatWithOpenAI(messages);
    } catch (error) {
      lastError = error;
      console.error(`[ai] ${provider} failed, trying next provider if available.`, error);
      // Only fall through to secondary when preference is auto and another provider remains.
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
