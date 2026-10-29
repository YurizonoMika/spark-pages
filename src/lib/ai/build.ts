import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Project } from "../../model/types";
import type { ChatToolTrace } from "../../store/aiChatStore";
import { listModuleDefinitions } from "../../modules/registry";
import { serializeProject } from "../../xml/projectXml";
import {
  chatCompletion,
  extractMessageText,
  type ChatCompletionResult,
  type ChatMessage,
} from "./client";
import type { AgentToolDefinition } from "./tools";
import type { AiConfig } from "./settings";
import {
  pageCodeDirectory,
  pageSlugs,
  projectSettingsSummary,
} from "./projectContext";

export interface GeneratedProjectFile {
  path: string;
  content: string;
}

export interface GeneratedProject {
  summary: string;
  files: GeneratedProjectFile[];
}

export interface BuildResult extends GeneratedProject {
  root: string;
}

export interface ProjectFileEntry {
  path: string;
  size: number;
  isDir: boolean;
}

const generatedFileSchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string().max(2_000_000),
});

const generatedProjectSchema = z.object({
  summary: z.string().optional().default(""),
  files: z.array(generatedFileSchema).min(1).max(120),
});

const PAGE_REQUIREMENTS = `页面与视觉要求：
1. 保留 XML 中所有文案、模块内容、视觉层级、主题色、字体感觉、圆角、间距和页面尺寸意图。
2. 不要机械复刻 XML 的绝对坐标；使用响应式/流式布局，同时保持设计意图。
3. 如果 XML 中存在 <animations>，使用 CSS/JS 实现出场、循环和离场动画，并保留 duration、delay、exit-delay、easing。
4. 如果 XML 中存在 <keyframes>，按轨道实现关键帧动画，保留 duration、loop、时间点、值和缓动；x/y 使用 translate，scale 使用 scale，rotate 使用 rotate，opacity 使用 opacity，blur/brightness/saturate 使用 filter。
5. anchor-x="right" / anchor-y="bottom" 表示相对页面右/下边缘定位，布局时保持这种参照关系。
6. 页面脚本必须完整保留并实际执行：不能省略、截断、改写成占位注释或只保留 TODO。
   - HTML 项目：每个有脚本的页面写入 pages/<slug>/script.js，并在页面 HTML 中用 <script src="./script.js" defer></script> 引用；如果脚本语言是 TypeScript，需转写为行为等价的 JavaScript。
   - Vue 项目：完整写入对应页面的 <script setup lang="ts"> 或同目录 logic.ts，并在组件中实际执行。
7. 不要引用不存在的本地资源；图片可以使用占位图、CDN 或内联 SVG。
8. 页面应当响应式、可访问、无控制台错误。`;

function projectLayoutRules(project: Project): string {
  if (project.type === "vue") {
    return `目标项目：Vue + TS（Vite + Vue 3 + TypeScript）。所有生成文件都写入项目目录的 build/ 文件夹，以下路径均相对 build/。
文件布局：
- package.json：scripts.dev 必须为 vite；dependencies 包含 vue；devDependencies 包含 vite、@vitejs/plugin-vue、typescript、vue-tsc。
- vite.config.ts、tsconfig.json、index.html、src/main.ts、src/App.vue。
- 每个页面写到 src/pages/<slug>/index.vue，使用 <script setup lang="ts">；复杂逻辑可拆分到同目录的 logic.ts，样式可拆分到 style.css 并在 SFC 中导入。
- 复杂组件或需要 JSX 的组件可使用 .tsx（放在 src/components/ 或页面目录），并在 package.json 中加入 @vitejs/plugin-vue-jsx 及对应 Vite 配置。
- 每个页面额外生成 src/pages/<slug>/preview.html：静态、可独立打开的构建产物预览（内联样式/脚本），用于应用内预览。
- 共用组件写到 src/components/，共用样式写到 src/styles/。
- 如需路由，使用 vue-router，并同时更新 package.json 和 src/router.ts、src/main.ts。
- 页面 slug：${Array.from(pageSlugs(project).values()).join("、")}。`;
  }
  return `目标项目：HTML + JS 静态项目。所有生成文件都写入项目目录的 build/ 文件夹，以下路径均相对 build/。
文件布局：
- build/ 根目录 index.html 作为入口/导航页，链接到各个页面。
- 每个页面写到 pages/<slug>/index.html，样式写到 pages/<slug>/style.css，脚本写到 pages/<slug>/script.js（按需）。
- 可生成 assets/、公共 CSS/JS；所有引用使用相对路径。
- 不引入框架或打包工具，直接由浏览器打开 index.html 即可浏览。
- 页面 slug：${Array.from(pageSlugs(project).values()).join("、")}。`;
}

function systemPrompt(project: Project): string {
  return `你是资深网页设计师和前端工程师。你的任务是把 Spark Pages 的项目 XML 构建成完整的项目文件。

工作方式：
1. 先使用 read_project_file 读取需要修改的现有文件；首次构建可以跳过读取。
2. 使用 write_project_file 写入或覆盖文件，一次回复可以调用多个工具写入多个文件。
3. path 必须相对于构建目录 build/，使用正斜杠；禁止绝对路径和 ..。
4. 每个文件必须写入完整、可运行的内容，不能使用“省略”“同上”或占位注释代替代码。
5. 所有文件写完后调用 finish_project，summary 用一句中文概括结果。
6. 不要只输出 JSON、Markdown 代码块或文字说明来代替文件写入。

${projectLayoutRules(project)}

${PAGE_REQUIREMENTS}`;
}

function jsonSystemPrompt(project: Project): string {
  return `你是资深网页设计师和前端工程师。请把 Spark Pages 项目输出为 JSON 文件结构。

输出要求：
1. 只输出一个 JSON 对象：{"summary":"一句话说明","files":[{"path":"...","content":"..."}]}
2. path 相对于构建目录 build/，禁止绝对路径和 ..；文件内容必须完整可运行。
3. ${project.type === "vue" ? "必须包含 package.json、index.html，并至少包含一个 .vue 页面文件；package.json 必须包含 scripts.dev。" : "必须包含根目录 index.html，并至少包含一个 HTML 页面文件。"}
4. ${projectLayoutRules(project)}
5. ${PAGE_REQUIREMENTS}`;
}

function pageScriptTarget(project: Project, slug: string): string {
  if (project.type === "vue") {
    return `${pageCodeDirectory(project, slug)}/index.vue 的 <script setup lang="ts">，或 ${pageCodeDirectory(project, slug)}/logic.ts`;
  }
  return `${pageCodeDirectory(project, slug)}/script.js`;
}

function pageScriptsPrompt(project: Project): string {
  const slugs = pageSlugs(project);
  const entries = project.pages
    .filter((page) => page.customScript?.trim())
    .map((page) => {
      const slug = slugs.get(page.id) ?? page.id;
      const language =
        page.scriptLanguage === "typescript" ? "typescript" : "javascript";
      const fence = language === "typescript" ? "ts" : "js";
      const note =
        project.type === "html" && language === "typescript"
          ? "\n注意：HTML 项目不能直接运行 TypeScript，请转写为行为等价的 JavaScript 后写入 script.js。"
          : "";
      return `### 页面「${page.title}」（${slug}）· ${language}
写入位置：${pageScriptTarget(project, slug)}${note}
\`\`\`${fence}
${page.customScript}
\`\`\``;
    });
  if (entries.length === 0) {
    return "页面脚本：所有页面均无自定义脚本。";
  }
  return `页面脚本（必须完整保留到构建产物，不能省略、截断或只留 TODO）：
${entries.join("\n\n")}`;
}

function moduleCatalog(project: Project): string {
  const used = new Set<string>();
  for (const page of project.pages) {
    for (const module of page.modules) {
      used.add(module.type);
    }
  }
  return listModuleDefinitions()
    .filter((definition) => used.has(definition.type))
    .map(
      (definition) =>
        `- ${definition.type}（${definition.label}）：${definition.ai?.description ?? definition.description}`,
    )
    .join("\n");
}

function existingFilesPrompt(files: string[]): string {
  if (files.length === 0) {
    return "build/ 构建目录中还没有现有代码文件。";
  }
  return `build/ 构建目录中已有文件（修改前建议先调用 read_project_file 读取）：
${files.slice(0, 220).map((path) => `- ${path}`).join("\n")}`;
}

export function buildProjectMessages(
  project: Project,
  instruction: string,
  existingFiles: string[] = [],
): ChatMessage[] {
  const userPrompt = `${projectSettingsSummary(project)}

${projectLayoutRules(project)}

${existingFilesPrompt(existingFiles)}

使用到的模块说明：
${moduleCatalog(project) || "仅使用 XML 中出现的模块"}

${pageScriptsPrompt(project)}

用户额外的构建要求：
${instruction.trim() || "无，请按 XML 设计生成高质量项目"}

Spark Pages 完整 XML：
${serializeProject(project)}`;

  return [
    { role: "system", content: systemPrompt(project) },
    { role: "user", content: userPrompt },
  ];
}

function normalizePath(path: string): string {
  const normalized = path.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`AI 返回了不安全的文件路径：${path}`);
  }
  return normalized;
}

export function validateProjectFiles(
  project: Project,
  files: GeneratedProjectFile[],
): void {
  const paths = new Set(files.map((file) => file.path));
  if (!paths.has("index.html")) {
    throw new Error("AI 生成的项目缺少根目录 index.html");
  }
  if (project.type === "vue") {
    for (const required of [
      "package.json",
      "src/main.ts",
      "src/App.vue",
    ]) {
      if (!paths.has(required)) {
        throw new Error(`AI 生成的 Vue 项目缺少 ${required}`);
      }
    }
    if (!files.some((file) => file.path.endsWith(".vue"))) {
      throw new Error("AI 生成的 Vue 项目缺少 .vue 页面文件");
    }
    const slugs = pageSlugs(project);
    for (const page of project.pages) {
      const directory = pageCodeDirectory(
        project,
        slugs.get(page.id) ?? page.id,
      );
      if (!paths.has(`${directory}/index.vue`)) {
        throw new Error(`Vue 页面缺少 ${directory}/index.vue`);
      }
      if (!paths.has(`${directory}/preview.html`)) {
        throw new Error(`Vue 页面缺少构建产物预览 ${directory}/preview.html`);
      }
    }
    const packageFile = files.find((file) => file.path === "package.json");
    if (packageFile) {
      let pkg: { scripts?: Record<string, string> };
      try {
        pkg = JSON.parse(packageFile.content) as {
          scripts?: Record<string, string>;
        };
      } catch (error) {
        throw new Error(
          `AI 生成的 package.json 不合法：${error instanceof Error ? error.message : "无法解析"}`,
        );
      }
      if (!pkg.scripts?.dev) {
        throw new Error("package.json 缺少 scripts.dev");
      }
    }
    return;
  }
  if (!files.some((file) => file.path.endsWith(".html"))) {
    throw new Error("AI 生成的 HTML 项目缺少 HTML 页面");
  }
  const slugs = pageSlugs(project);
  for (const page of project.pages) {
    if (!page.customScript?.trim()) {
      continue;
    }
    if (page.scriptLanguage === "typescript") {
      continue;
    }
    const directory = pageCodeDirectory(
      project,
      slugs.get(page.id) ?? page.id,
    );
    const script = files.find(
      (file) => file.path === `${directory}/script.js`,
    );
    if (!script || !script.content.trim()) {
      throw new Error(
        `页面「${page.title}」缺少完整页面脚本 ${directory}/script.js`,
      );
    }
    const pageHtml = files.find(
      (file) => file.path === `${directory}/index.html`,
    );
    if (!pageHtml || !pageHtml.content.includes("script.js")) {
      throw new Error(
        `页面「${page.title}」的 index.html 没有引用 ${directory}/script.js`,
      );
    }
  }
}

export function parseGeneratedProject(
  project: Project,
  raw: string,
): GeneratedProject {
  let candidate = raw.trim();
  if (!candidate) {
    throw new Error("模型返回了空内容");
  }

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidate = fenced[1].trim();
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("模型没有返回 JSON 项目结构，请重试或调整提示词");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new Error(
      `模型返回的 JSON 无法解析：${error instanceof Error ? error.message : "格式错误"}`,
    );
  }

  const validated = generatedProjectSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `模型返回的项目结构不合法：${validated.error.issues[0]?.message ?? "未知错误"}`,
    );
  }

  const seen = new Set<string>();
  const files = validated.data.files.map((file) => {
    const path = normalizePath(file.path);
    if (seen.has(path)) {
      throw new Error(`AI 返回了重复文件：${path}`);
    }
    seen.add(path);
    return { path, content: file.content };
  });

  validateProjectFiles(project, files);

  return {
    summary: validated.data.summary || "项目已生成",
    files,
  };
}

export const BUILD_TOOL_LABELS: Record<string, string> = {
  read_project_file: "读取项目文件",
  write_project_file: "写入项目文件",
  finish_project: "完成项目",
};

export const BUILD_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_project_file",
      description: "读取项目文件夹中的一个文本文件，修改已有代码前使用。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对路径，例如 src/App.vue" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_project_file",
      description:
        "在项目中创建或覆盖一个文件。必须传入完整文件内容，路径相对于项目根目录。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对路径，例如 index.html" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_project",
      description:
        "所有文件写入后调用，提交项目。缺少必要文件时会失败。",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "一句话概括生成的项目" },
        },
      },
    },
  },
];

export interface BuildAgentCallbacks {
  onStatus?: (status: string) => void;
  onAssistantMessage?: (text: string) => void;
  onTool?: (trace: ChatToolTrace) => void;
}

const MAX_BUILD_ROUNDS = 32;
const MAX_BUILD_FILE_BYTES = 2_000_000;
const MAX_BUILD_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_BUILD_FILES = 120;
const MAX_READ_BYTES = 60_000;

interface BuildAgentState {
  project: Project;
  files: Map<string, string>;
  sizes: Map<string, number>;
  bytes: number;
  summary: string;
  finished: boolean;
}

interface BuildToolResult {
  ok: boolean;
  summary: string;
  result?: unknown;
  modelResult?: unknown;
  error?: string;
  finished?: boolean;
}

function formatBuildSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function requiredBuildString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`缺少字符串参数 ${key}`);
  }
  return value;
}

function buildFiles(state: BuildAgentState): GeneratedProjectFile[] {
  return Array.from(state.files.entries()).map(([path, content]) => ({
    path,
    content,
  }));
}

function buildToolFailure(error: unknown): BuildToolResult {
  return {
    ok: false,
    summary: "工具调用失败",
    error: error instanceof Error ? error.message : "工具执行失败",
  };
}

function absoluteProjectPath(root: string, path: string): string {
  return `${root.replace(/[\\/]+$/, "")}/${path}`;
}

async function executeBuildTool(
  name: string,
  args: Record<string, unknown>,
  state: BuildAgentState,
  root: string,
): Promise<BuildToolResult> {
  if (name === "read_project_file") {
    try {
      const path = normalizePath(requiredBuildString(args, "path"));
      const content = await invoke<string>("read_text_file", {
        path: absoluteProjectPath(root, path),
      });
      const truncated =
        content.length > MAX_READ_BYTES
          ? `${content.slice(0, MAX_READ_BYTES)}\n…（文件已截断）`
          : content;
      return {
        ok: true,
        summary: `读取 ${path}（${formatBuildSize(new TextEncoder().encode(content).length)}）`,
        result: {
          path,
          bytes: new TextEncoder().encode(content).length,
          preview: truncated.slice(0, 500),
        },
        modelResult: { path, content: truncated },
      };
    } catch (error) {
      return buildToolFailure(error);
    }
  }

  if (name === "write_project_file") {
    try {
      const path = normalizePath(requiredBuildString(args, "path"));
      if (path.toLowerCase().endsWith(".spark")) {
        throw new Error("不能覆盖 Spark Pages 项目文件");
      }
      if (/^(node_modules|\.git|dist|build)\//.test(path)) {
        throw new Error("不能写入依赖、构建产物或版本控制目录");
      }
      const content = requiredBuildString(args, "content");
      const bytes = new TextEncoder().encode(content).length;
      if (bytes > MAX_BUILD_FILE_BYTES) {
        throw new Error(`文件过大：${path}（${formatBuildSize(bytes)}）`);
      }
      const previousBytes = state.sizes.get(path) ?? 0;
      if (!state.files.has(path) && state.files.size >= MAX_BUILD_FILES) {
        throw new Error(`文件数量过多（最多 ${MAX_BUILD_FILES} 个）`);
      }
      const nextBytes = state.bytes - previousBytes + bytes;
      if (nextBytes > MAX_BUILD_TOTAL_BYTES) {
        throw new Error("生成内容总大小超出限制");
      }
      const existed = state.files.has(path);
      state.files.set(path, content);
      state.sizes.set(path, bytes);
      state.bytes = nextBytes;
      return {
        ok: true,
        summary: `${existed ? "更新" : "写入"} ${path}（${formatBuildSize(bytes)}）`,
        result: { path, bytes, files: state.files.size },
      };
    } catch (error) {
      return buildToolFailure(error);
    }
  }

  if (name === "finish_project") {
    try {
      const files = buildFiles(state);
      validateProjectFiles(state.project, files);
      state.summary =
        typeof args.summary === "string" ? args.summary.trim() : "";
      state.finished = true;
      return {
        ok: true,
        summary: `项目文件已就绪（${files.length} 个文件）`,
        result: { files: files.length },
        finished: true,
      };
    } catch (error) {
      return buildToolFailure(error);
    }
  }

  return buildToolFailure(new Error(`未知工具：${name}`));
}

function summarizeBuildArgs(
  name: string,
  args: Record<string, unknown>,
  raw: string,
): string {
  if (name === "read_project_file") {
    return `path: ${typeof args.path === "string" ? args.path : ""}`;
  }
  if (name === "write_project_file") {
    const path = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : "";
    const preview =
      content.length > 500 ? `${content.slice(0, 500)}\n…` : content;
    return `path: ${path}\nbytes: ${new TextEncoder().encode(content).length}\n\n${preview}`;
  }
  if (name === "finish_project") {
    return `summary: ${typeof args.summary === "string" ? args.summary : ""}`;
  }
  return raw.slice(0, 2000);
}

function generatedFromBuildState(
  state: BuildAgentState,
  fallbackSummary: string,
): GeneratedProject {
  const files = buildFiles(state);
  validateProjectFiles(state.project, files);
  return {
    summary: state.summary || fallbackSummary.trim() || "项目已生成",
    files,
  };
}

function isToolCallingUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /tool|function|工具|函数/i.test(message) &&
    /400|不支持|unsupported|not support|invalid/i.test(message)
  );
}

async function generateProjectJson(
  project: Project,
  config: AiConfig,
  instruction: string,
  existingFiles: string[],
  callbacks: BuildAgentCallbacks,
): Promise<GeneratedProject> {
  const messages = buildProjectMessages(project, instruction, existingFiles);
  messages[0] = { role: "system", content: jsonSystemPrompt(project) };
  const result = await chatCompletion(config, messages, {
    temperature: Math.min(config.temperature, 0.8),
    maxTokens: config.maxTokens,
  });
  const text = extractMessageText(result.message);
  if (text.trim()) {
    callbacks.onAssistantMessage?.(text);
  }
  return parseGeneratedProject(project, text);
}

export async function generateProjectFiles(
  project: Project,
  config: AiConfig,
  instruction: string,
  root: string,
  existingFiles: string[] = [],
  callbacks: BuildAgentCallbacks = {},
): Promise<GeneratedProject> {
  const messages = buildProjectMessages(project, instruction, existingFiles);
  const state: BuildAgentState = {
    project,
    files: new Map(),
    sizes: new Map(),
    bytes: 0,
    summary: "",
    finished: false,
  };

  for (let round = 0; round < MAX_BUILD_ROUNDS; round += 1) {
    callbacks.onStatus?.(
      round === 0
        ? "AI 正在规划项目结构…"
        : `AI 正在继续生成（第 ${round + 1} 轮）…`,
    );
    let result: ChatCompletionResult;
    try {
      result = await chatCompletion(config, messages, {
        temperature: Math.min(config.temperature, 0.8),
        maxTokens: config.maxTokens,
        tools: BUILD_TOOLS,
        toolChoice: "auto",
      });
    } catch (error) {
      if (
        round === 0 &&
        state.files.size === 0 &&
        isToolCallingUnsupported(error)
      ) {
        callbacks.onStatus?.(
          "当前模型不支持工具调用，正在回退为一次性 JSON 生成…",
        );
        return generateProjectJson(
          project,
          config,
          instruction,
          existingFiles,
          callbacks,
        );
      }
      throw error;
    }
    const text = extractMessageText(result.message).trim();
    if (text) {
      callbacks.onAssistantMessage?.(text);
    }
    const toolCalls = result.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      if (state.files.size === 0 && text) {
        callbacks.onStatus?.("AI 未调用文件工具，正在解析 JSON 输出…");
        return parseGeneratedProject(project, text);
      }
      callbacks.onStatus?.("AI 已完成输出，正在校验项目…");
      return generatedFromBuildState(state, text);
    }

    messages.push({
      role: "assistant",
      content: text || null,
      // File contents are already in the tool result and in memory. Keeping
      // them in later rounds would multiply token usage.
      tool_calls: toolCalls.map((call) => ({
        ...call,
        function: { ...call.function, arguments: "{}" },
      })),
    });

    for (let index = 0; index < toolCalls.length; index += 1) {
      const call = toolCalls[index];
      const name = call.function.name;
      const label = BUILD_TOOL_LABELS[name] ?? name;
      let args: Record<string, unknown> = {};
      let parseError: string | null = null;
      try {
        args = call.function.arguments
          ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        parseError = "工具参数不是有效 JSON";
      }

      const execution = parseError
        ? buildToolFailure(new Error(parseError))
        : await executeBuildTool(name, args, state, root);
      const trace: ChatToolTrace = {
        id: call.id || nanoid(),
        name,
        label,
        args: summarizeBuildArgs(name, args, call.function.arguments),
        status: execution.ok ? "success" : "error",
        summary: execution.summary,
        result: execution.ok
          ? JSON.stringify(execution.result ?? null)
          : undefined,
        error: execution.error,
      };
      callbacks.onTool?.(trace);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(
          execution.ok
            ? {
                ok: true,
                summary: execution.summary,
                result: execution.modelResult ?? execution.result ?? null,
              }
            : { ok: false, error: execution.error },
        ),
      });

      if (execution.finished) {
        state.finished = true;
        break;
      }
    }

    if (state.finished) {
      break;
    }
  }

  if (state.files.size === 0) {
    throw new Error("AI 构建没有生成任何文件，请重试或调整构建要求。");
  }
  callbacks.onStatus?.("正在校验生成的项目文件…");
  return generatedFromBuildState(state, "");
}

export async function listProjectFiles(root: string): Promise<ProjectFileEntry[]> {
  return invoke<ProjectFileEntry[]>("list_project_files", { root });
}

export async function writeBuildFiles(
  root: string,
  files: GeneratedProjectFile[],
): Promise<string> {
  return invoke<string>("write_build_files", {
    root,
    files,
  });
}
