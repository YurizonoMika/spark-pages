import type { Page, ScriptBlock, ScriptBlockKind } from "../model/types";
import { scriptBlockCode } from "../model/scriptBoard";

function variableName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? "").trim().replace(/[^\w$]/g, "_");
  return /^[A-Za-z_$][\w$]*$/.test(cleaned) ? cleaned : fallback;
}

const CONTAINER_KINDS = new Set<ScriptBlockKind>([
  "trigger_ready",
  "trigger_event",
  "trigger_timer",
  "input_to_state",
  "fetch_data",
  "condition",
  "loop",
  "delay",
  "start",
  "event",
  "if",
  "function",
]);

/**
 * 按照连线把低代码积木直接拼装成页面脚本。
 * 触发、条件、循环、请求等容器积木会把连线指向的积木放进自己的代码块里。
 * 自然语言积木无法直接编译，需要交给 AI 生成代码。
 */
export function compileScriptBoard(page: Page): string {
  const board = page.scriptBoard;
  if (!board || board.blocks.length === 0) {
    return "";
  }
  const natural = board.blocks.find((block) => block.kind === "natural");
  if (natural) {
    throw new Error(
      `积木“${natural.title}”使用自然语言描述，请改用“AI 生成代码”把它转换成脚本`,
    );
  }

  const byId = new Map(board.blocks.map((block) => [block.id, block]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Set<string>();
  for (const connection of board.connections) {
    if (!byId.has(connection.from) || !byId.has(connection.to)) {
      continue;
    }
    incoming.add(connection.to);
    const targets = outgoing.get(connection.from) ?? [];
    targets.push(connection.to);
    outgoing.set(connection.from, targets);
  }

  const emitted = new Set<string>();
  const visiting = new Set<string>();

  const compile = (block: ScriptBlock): string => {
    if (emitted.has(block.id) || visiting.has(block.id)) {
      return "";
    }
    visiting.add(block.id);
    const children = (outgoing.get(block.id) ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is ScriptBlock => Boolean(child))
      .map(compile)
      .filter(Boolean)
      .join("\n");
    const fields = block.fields ?? {};
    const code = CONTAINER_KINDS.has(block.kind)
      ? scriptBlockCode(block.kind, fields, children)
      : [scriptBlockCode(block.kind, fields), children]
          .filter(Boolean)
          .join("\n");
    visiting.delete(block.id);
    emitted.add(block.id);
    return code;
  };

  const chunks: string[] = [];
  // 先编译没有输入连线的起点，保证触发器和变量声明排在前面。
  for (const block of board.blocks) {
    if (!incoming.has(block.id) && !emitted.has(block.id)) {
      chunks.push(compile(block));
    }
  }
  // 环形连接或没有起点的积木仍然按画板顺序输出，避免遗漏。
  for (const block of board.blocks) {
    if (!emitted.has(block.id)) {
      chunks.push(compile(block));
    }
  }

  // 输入和接口积木会写入变量；变量积木没有提前声明时自动补上声明。
  const declared = new Set<string>();
  const assigned = new Set<string>();
  for (const block of board.blocks) {
    const fields = block.fields ?? {};
    if (block.kind === "state") {
      declared.add(variableName(fields.name, "value"));
    } else if (block.kind === "state_set") {
      assigned.add(variableName(fields.name, "value"));
    } else if (block.kind === "input_to_state") {
      assigned.add(variableName(fields.variable, "inputValue"));
    } else if (block.kind === "fetch_data") {
      assigned.add(variableName(fields.variable, "data"));
    }
  }
  const prelude = [...assigned]
    .filter((name) => !declared.has(name))
    .map((name) => `let ${name};`);

  return [...prelude, ...chunks]
    .filter((chunk) => chunk.trim())
    .join("\n\n");
}
