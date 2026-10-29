import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AiConfig } from "./settings";

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ChatResponseMessage {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }> | null;
  tool_calls?: ChatToolCall[];
}

export interface ChatCompletionResult {
  message: ChatResponseMessage;
  usage?: unknown;
}

export const AI_PROFILE_ID = "default";

function requireTauri(): void {
  if (!isTauri()) {
    throw new Error("AI 请求仅支持桌面应用，请通过 npm run tauri dev 启动");
  }
}

export async function chatCompletion(
  config: AiConfig,
  messages: ChatMessage[],
  overrides: {
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
    toolChoice?: unknown;
  } = {},
): Promise<ChatCompletionResult> {
  requireTauri();
  return invoke<ChatCompletionResult>("chat_completion", {
    request: {
      profile: AI_PROFILE_ID,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      temperature: overrides.temperature ?? config.temperature,
      maxTokens: overrides.maxTokens ?? config.maxTokens,
      tools: overrides.tools,
      toolChoice: overrides.toolChoice,
    },
  });
}

export function extractMessageText(message: ChatResponseMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

export async function saveApiKey(key: string): Promise<void> {
  requireTauri();
  await invoke("save_api_key", { profile: AI_PROFILE_ID, key });
}

export async function hasApiKey(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  return invoke<boolean>("has_api_key", { profile: AI_PROFILE_ID });
}

export async function deleteApiKey(): Promise<void> {
  requireTauri();
  await invoke("delete_api_key", { profile: AI_PROFILE_ID });
}
