import type { Page } from "../../model/types";
import {
  chatCompletion,
  extractMessageText,
  type ChatMessage,
} from "./client";
import type { AiConfig } from "./settings";
import { scriptBlockTemplate } from "../../model/scriptBoard";

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function buildScriptBoardMessages(
  page: Page,
  instruction: string,
): ChatMessage[] {
  const board = page.scriptBoard;
  const blocks = board?.blocks ?? [];
  const connections = board?.connections ?? [];
  const blockLines = blocks
    .map((block) => {
      const template = scriptBlockTemplate(block.kind);
      if (block.kind === "natural") {
        return `### 自然语言说明 ${block.id} · ${block.title}
功能描述：
${block.code}`;
      }
      return `### 积木 ${block.id} · ${template.label}
标题：${block.title}
代码草稿：
\`\`\`js
${block.code}
\`\`\`${block.fields ? `\n可视化字段：\n${Object.entries(block.fields)
        .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
        .join("\n")}` : ""}`;
    })
    .join("\n\n");
  const connectionLines = connections
    .map((connection) => {
      const from = blocks.find((block) => block.id === connection.from);
      const to = blocks.find((block) => block.id === connection.to);
      return `- ${from?.title ?? connection.from} → ${to?.title ?? connection.to}`;
    })
    .join("\n");
  const moduleLines = page.modules
    .map(
      (module) =>
        `- ${module.id}：${module.type}（可用 getElementById("${module.id}") 访问）`,
    )
    .join("\n");

  return [
    {
      role: "system",
      content: `你是资深前端 JavaScript 工程师。用户用思维导图积木画出了页面脚本草稿，请把它整理成可直接放入页面的完整 JavaScript。

要求：
1. 严格按照积木之间的连接关系组织代码流程；没有连接的积木可以按合理顺序整理。
2. 带有“自然语言说明”的积木是用户对代码功能的需求描述，必须转换成真实可运行的代码，不能原样保留为注释。
3. 保留每个代码积木中的代码意图、变量名和业务逻辑，不要省略或只写 TODO。
4. 将同一流程中的积木合并为完整、可运行的代码；需要时使用 DOMContentLoaded 或 IIFE 等待 DOM。
5. 页面模块可以通过 document.getElementById("模块 ID") 访问，下面列出了可用 ID。
6. 只输出完整的 JavaScript 代码，不要 Markdown 代码围栏、解释文字或省略号。
7. 代码必须能在浏览器中直接运行，不要引用不存在的资源。`,
    },
    {
      role: "user",
      content: `页面：${page.title}
页面尺寸：${page.width}×${page.height}
当前脚本语言：${page.scriptLanguage === "typescript" ? "TypeScript" : "JavaScript"}

可用页面模块：
${moduleLines || "无"}

连接关系：
${connectionLines || "无（按积木顺序整理）"}

积木草稿：
${blockLines || "（没有积木）"}

用户补充要求：
${instruction.trim() || "无，请根据积木生成完整脚本"}`,
    },
  ];
}

export async function generateScriptFromBoard(
  page: Page,
  config: AiConfig,
  instruction: string,
): Promise<string> {
  if (!page.scriptBoard || page.scriptBoard.blocks.length === 0) {
    throw new Error("画板中还没有积木");
  }
  const result = await chatCompletion(
    config,
    buildScriptBoardMessages(page, instruction),
    {
      temperature: Math.min(config.temperature, 0.6),
      maxTokens: config.maxTokens,
    },
  );
  const code = stripCodeFence(extractMessageText(result.message));
  if (!code) {
    throw new Error("AI 没有返回代码");
  }
  return code;
}

export interface ScriptBlockUpdate {
  id: string;
  title?: string;
  code: string;
}

export function buildSelectedBlockMessages(
  page: Page,
  blockIds: string[],
  instruction: string,
): ChatMessage[] {
  const board = page.scriptBoard;
  const selected = (board?.blocks ?? []).filter((block) =>
    blockIds.includes(block.id),
  );
  if (selected.length === 0) {
    throw new Error("没有选中的脚本积木");
  }
  const blocks = selected
    .map((block) => {
      const template = scriptBlockTemplate(block.kind);
      return `### ${block.id} · ${template.label}
标题：${block.title}
当前内容：
\`\`\`
${block.code}
\`\`\``;
    })
    .join("\n\n");
  return [
    {
      role: "system",
      content: `你是资深前端 JavaScript 工程师，正在修改脚本画板中被魔杖选中的积木。
只修改选中的积木，不要重写未选中的积木。保留用户原有业务逻辑和变量名，除非用户明确要求改动。

只返回如下 JSON（不要 Markdown 代码围栏、不要解释）：
{"blocks":[{"id":"积木 ID","title":"标题","code":"完整的新内容"}]}

要求：
1. 每个被选中的积木都必须出现在 blocks 数组中。
2. id 必须使用下面提供的原始 ID，不能修改。
3. code 必须是该积木修改后的完整内容，不能只返回片段。
4. 自然语言积木的 code 保存的是自然语言功能描述，请保持这种形式。
5. 不要返回未选中的积木。`,
    },
    {
      role: "user",
      content: `页面：${page.title}
用户修改要求：
${instruction.trim() || "请优化选中积木的代码"}

被选中的积木：
${blocks}`,
    },
  ];
}

export async function generateSelectedBlockUpdates(
  page: Page,
  blockIds: string[],
  config: AiConfig,
  instruction: string,
): Promise<ScriptBlockUpdate[]> {
  const result = await chatCompletion(
    config,
    buildSelectedBlockMessages(page, blockIds, instruction),
    {
      temperature: Math.min(config.temperature, 0.5),
      maxTokens: config.maxTokens,
    },
  );
  const text = extractMessageText(result.message).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI 没有返回可解析的积木修改结果");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new Error(
      `AI 返回的 JSON 无法解析：${error instanceof Error ? error.message : "格式错误"}`,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { blocks?: unknown }).blocks)
  ) {
    throw new Error("AI 返回的积木结果格式不正确");
  }
  const selectedIds = new Set(blockIds);
  const updates = ((parsed as { blocks: unknown[] }).blocks ?? [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      if (
        typeof record.id !== "string" ||
        !selectedIds.has(record.id) ||
        typeof record.code !== "string"
      ) {
        return null;
      }
      return {
        id: record.id,
        code: record.code,
        ...(typeof record.title === "string"
          ? { title: record.title }
          : {}),
      };
    })
    .filter((update): update is ScriptBlockUpdate => Boolean(update));
  if (updates.length === 0) {
    throw new Error("AI 没有返回任何选中的积木");
  }
  return updates;
}
