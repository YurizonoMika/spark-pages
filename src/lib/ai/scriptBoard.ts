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
      return `### 积木 ${block.id} · ${template.label}
标题：${block.title}
代码草稿：
\`\`\`js
${block.code}
\`\`\``;
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
2. 保留每个积木中的代码意图、变量名和业务逻辑，不要省略或只写 TODO。
3. 将同一流程中的积木合并为完整、可运行的代码；需要时使用 DOMContentLoaded 或 IIFE 等待 DOM。
4. 页面模块可以通过 document.getElementById("模块 ID") 访问，下面列出了可用 ID。
5. 只输出完整的 JavaScript 代码，不要 Markdown 代码围栏、解释文字或省略号。
6. 代码必须能在浏览器中直接运行，不要引用不存在的资源。`,
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
