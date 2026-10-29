import type { AiConfig } from "./settings";
import {
  chatCompletion,
  extractMessageText,
  type ChatMessage,
} from "./client";
import {
  AGENT_TOOLS,
  executeAgentTool,
  TOOL_LABELS,
} from "./tools";
import {
  CURRENT_FILE_TOOLS,
  executeCurrentFileTool,
  isCurrentFileTool,
  isPageFileTool,
} from "./pageFileTools";
import { agentSkill, type AgentSkill } from "./skills";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import type { ChatToolTrace } from "../../store/aiChatStore";
import {
  getModuleDefinitionSafe,
  listModuleDefinitions,
} from "../../modules/registry";

const MAX_TOOL_ROUNDS = 12;

export type AgentDocumentScope =
  | { kind: "page"; pageId: string }
  | {
      kind: "file";
      path: string;
      name: string;
      language: string;
    };

function currentDocumentScope(): AgentDocumentScope | null {
  const state = useEditorStore.getState();
  if (state.activeFilePath && state.fileView !== "script") {
    const file = state.openFiles.find(
      (candidate) => candidate.path === state.activeFilePath,
    );
    if (file) {
      return {
        kind: "file",
        path: file.path,
        name: file.name,
        language: file.language,
      };
    }
  }
  const pageTabOpen = state.openDocuments.some(
    (document) =>
      document.kind === "page" &&
      document.pageId === state.activePageId,
  );
  if (pageTabOpen || state.fileView === "script") {
    return { kind: "page", pageId: state.activePageId };
  }
  return null;
}

function buildFileSystemPrompt(
  skill: AgentSkill,
  scope: Extract<AgentDocumentScope, { kind: "file" }>,
): string {
  const state = useEditorStore.getState();
  return `你是 Spark Pages 的文件编辑 Agent。当前标签页是一个已打开的代码文件，本轮只能读写这个文件；XML 设计稿、页面脚本和其他文件都不可访问。

当前文件：${scope.name}（${scope.language}）
文件路径：${scope.path}
当前项目：${state.project.name}

工作规则：
1. 修改前先调用 read_current_file 读取当前文件内容。
2. 只能通过 write_current_file 写入当前文件，content 必须是修改后的完整文件内容，不要只写片段。
3. 不要尝试读写其他文件，也不要修改 XML 设计稿或页面脚本；如果用户要求修改页面设计或页面脚本，请说明需要切换到对应标签页。
4. 保持文件现有语法和风格，确保修改后的代码完整可用。
5. 完成后用简洁中文说明改了哪些内容；不要虚构未执行的操作。可以使用 Markdown 组织回答。
6. 当前技能：${skill.label}。${skill.prompt}`;
}

function buildSystemPrompt(
  skill: AgentSkill,
  scope: AgentDocumentScope | null,
): string {
  if (scope?.kind === "file") {
    return buildFileSystemPrompt(skill, scope);
  }
  const state = useEditorStore.getState();
  if (!scope) {
    return `你是 Spark Pages 的页面编辑 Agent。当前没有打开的文档标签页，本轮不能读写任何内容。

当前项目：${state.project.name}

工作规则：
1. 不要调用任何工具，也不要假装已经修改了页面或代码。
2. 用简洁中文告诉用户：请先打开 .spark 页面设计稿或构建产物文件标签页，然后再提出修改需求。
3. 当前技能：${skill.label}。${skill.prompt}`;
  }
  const page = selectActivePage(state);
  const selected = page.modules.filter((module) =>
    state.selection.includes(module.id),
  );
  const catalog = listModuleDefinitions()
    .map((definition) => {
      const fields = definition.fields
        .map((field) => field.key)
        .join(", ");
      return `- ${definition.type}: ${definition.label} (${definition.category}) - ${definition.ai?.description ?? definition.description}；默认尺寸 ${definition.defaultSize.width}×${definition.defaultSize.height}；字段: ${fields || "无"}`;
    })
    .join("\n");
  const selectionInfo =
    selected.length > 0
      ? selected
          .map((module) => {
            const definition = getModuleDefinitionSafe(module.type);
            return `- ${module.id}: ${definition.label}（${module.type}）`;
          })
          .join("\n")
      : "无";

  return `你是 Spark Pages 的可视化页面编辑 Agent。当前项目与页面通过工具读取和修改，XML 是唯一数据源。

当前文档：.spark 页面设计稿「${page.title}」，只能读写这个设计稿
当前项目：${state.project.name}（${state.project.type === "vue" ? "Vue + TS 项目" : "HTML + JS 项目"}）
当前页面：${page.title}，${page.width}×${page.height}px，网格 ${page.grid}px，背景 ${page.background}
页面模块数：${page.modules.length}
当前选中模块：
${selectionInfo}

可用模块类型：
${catalog}

工作规则：
1. 修改结构前先调用 get_page 了解当前页面；需要模块字段时调用 list_module_types；修改特定模块前可调用 get_module。
2. 只能使用工具真实存在的模块 ID，不要臆造 ID。
3. 坐标使用页面像素，会被自动吸附到网格；默认 anchorX/anchorY 为 left/top。anchorX=right 时 x 表示距右边距离，anchorY=bottom 时 y 表示距下边距离。
4. 批量生成页面时，尽量用一次 insert_modules 插入多个模块；不要一次只插入一个模块。
5. 保留用户已有文案和内容，除非用户明确要求改写或重设计。
6. 不要输出 XML、JSON 代码块或工具调用说明来代替工具执行。
7. 完成后用简洁中文说明改了哪些内容；不要虚构未执行的操作。可以使用 Markdown 组织回答（标题、列表、代码块）。
8. 动画编辑：使用 set_preset_animation 设置出场/循环/离场，使用 set_animation_timing 设置时长和循环，使用 add_animation_track、add_animation_keyframe、update_animation_keyframe、remove_animation_keyframe 编辑关键帧。修改前先读取页面或模块以取得现有动画和 keyframeId。
9. 页面脚本：用户要求“写脚本 / 加交互 / 修改页面逻辑”时，使用 read_page_script 读取当前页面脚本，再使用 write_page_script 写入完整脚本。脚本保存在 XML 设计稿中并进入撤销历史；language 可选 javascript 或 typescript，默认保持当前语言。
10. 当前标签是页面设计稿，只能读写这个设计稿（模块、页面设置、主题、动画、页面脚本）。不要读写项目里的 HTML/CSS/JS/TS/Vue 等代码文件；需要修改构建产物时，请提示用户切换到对应的文件标签页。
11. 当前技能：${skill.label}。${skill.prompt}`;
}

function buildUserContent(
  text: string,
  selectedModuleIds: string[],
): string {
  const state = useEditorStore.getState();
  const page = selectActivePage(state);
  const selected = page.modules.filter((module) =>
    selectedModuleIds.includes(module.id),
  );
  if (selected.length === 0) {
    return text;
  }
  const selection = selected
    .map(
      (module) =>
        `- ${module.id}：${module.type}，位置 ${module.x},${module.y}，尺寸 ${module.width}×${module.height}`,
    )
    .join("\n");
  return `${text}\n\n[当前魔杖选区]\n${selection}\n请优先针对这些模块修改，除非用户要求修改其他内容。`;
}

function toolsForSkill(skill: AgentSkill) {
  if (!skill.allowedTools || skill.allowedTools.length === 0) {
    return AGENT_TOOLS;
  }
  const allowed = new Set(skill.allowedTools);
  return AGENT_TOOLS.filter((tool) => allowed.has(tool.function.name));
}

function toolsForScope(
  skill: AgentSkill,
  scope: AgentDocumentScope | null,
) {
  if (!scope) {
    return [];
  }
  if (scope.kind === "file") {
    return CURRENT_FILE_TOOLS;
  }
  return toolsForSkill(skill).filter(
    (tool) => !isPageFileTool(tool.function.name),
  );
}

function summarizeTraces(traces: ChatToolTrace[]): string {
  const successful = traces.filter((trace) => trace.status === "success");
  if (successful.length === 0) {
    return "Agent 已完成本轮处理。";
  }
  return `已完成 ${successful.length} 项操作：${successful
    .map((trace) => trace.label)
    .join("、")}。`;
}

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentOptions {
  config: AiConfig;
  skillId: string;
  history: AgentHistoryMessage[];
  userText: string;
  selectedModuleIds: string[];
  onStatus?: (status: string) => void;
  onTrace?: (trace: ChatToolTrace) => void;
  isCancelled?: () => boolean;
}

export interface RunAgentResult {
  content: string;
  traces: ChatToolTrace[];
}

export async function runAgentTurn(
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const skill = agentSkill(options.skillId);
  const scope = currentDocumentScope();
  const tools = toolsForScope(skill, scope);
  const allowedNames = new Set(tools.map((tool) => tool.function.name));
  const traces: ChatToolTrace[] = [];
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(skill, scope) },
    ...options.history
      .filter((message) => message.content.trim())
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    {
      role: "user",
      content: buildUserContent(
        options.userText,
        options.selectedModuleIds,
      ),
    },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    if (options.isCancelled?.()) {
      return { content: "已停止本轮处理。", traces };
    }
    options.onStatus?.(
      round === 0 ? "Agent 正在思考…" : "Agent 正在继续处理…",
    );
    const result = await chatCompletion(options.config, messages, {
      tools,
      toolChoice: "auto",
    });
    if (options.isCancelled?.()) {
      return { content: "已停止本轮处理。", traces };
    }

    const text = extractMessageText(result.message).trim();
    const toolCalls = result.message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        content: text || summarizeTraces(traces),
        traces,
      };
    }

    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (options.isCancelled?.()) {
        return { content: "已停止本轮处理。", traces };
      }
      const name = call.function.name;
      const label = TOOL_LABELS[name] ?? name;
      options.onStatus?.(`正在执行：${label}…`);

      let args: unknown = {};
      let parseError: string | null = null;
      try {
        args = call.function.arguments
          ? JSON.parse(call.function.arguments)
          : {};
      } catch {
        parseError = "工具参数不是有效 JSON";
      }

      const rawArgs =
        args !== null && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {};
      const execution =
        parseError || !allowedNames.has(name)
          ? {
              ok: false,
              error:
                parseError ??
                `当前文档范围不允许调用工具：${name}`,
              summary: `工具执行失败：${label}`,
            }
          : isCurrentFileTool(name) && scope?.kind === "file"
            ? await executeCurrentFileTool(name, rawArgs, scope.path)
            : executeAgentTool(name, args);
      const resultText = JSON.stringify(
        execution.ok
          ? {
              ok: true,
              summary: execution.summary,
              result: execution.result ?? null,
            }
          : { ok: false, error: execution.error },
      );
      const trace: ChatToolTrace = {
        id: call.id,
        name,
        label,
        args: call.function.arguments || "{}",
        status: execution.ok ? "success" : "error",
        summary: execution.summary,
        result: execution.ok
          ? (JSON.stringify(execution.result ?? null) ?? "").slice(0, 2400)
          : undefined,
        error: execution.error,
      };
      traces.push(trace);
      options.onTrace?.(trace);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: resultText,
      });
    }
  }

  return {
    content: `已达到工具调用上限（${MAX_TOOL_ROUNDS} 轮）。${summarizeTraces(traces)}`,
    traces,
  };
}
