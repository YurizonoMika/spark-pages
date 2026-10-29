import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import type { ChatToolTrace } from "../../store/aiChatStore";
import type { Page, Project } from "../../model/types";
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
  pageSettingsSummary,
  pageSlug,
  projectSettingsSummary,
  projectTypeLabel,
} from "./projectContext";

export interface BuiltPageFile {
  path: string;
  content: string;
}

export interface BuiltPage {
  summary: string;
  files: BuiltPageFile[];
}

export interface PageBuildCallbacks {
  onStatus?: (status: string) => void;
  onAssistantMessage?: (text: string) => void;
  onTool?: (trace: ChatToolTrace) => void;
}

export interface PageBuildOptions {
  root: string;
  existingFiles?: string[];
  callbacks?: PageBuildCallbacks;
}

export const PAGE_BUILD_TOOL_LABELS: Record<string, string> = {
  read_page_file: "读取页面文件",
  write_page_file: "写入页面文件",
  finish_page: "完成页面",
};

export const PAGE_BUILD_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_page_file",
      description:
        "读取项目中的一个文本文件，修改已有页面代码前使用。path 相对于项目根目录。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对路径" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_page_file",
      description:
        "写入或覆盖当前页面的一个文件。HTML、CSS、JS、Vue、TS 等应分开存放；path 必须位于当前页面目录内。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对路径" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_page",
      description: "页面文件写入完成后调用，提交页面构建结果。",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "一句话概括页面构建结果" },
        },
      },
    },
  },
];

const MAX_PAGE_BUILD_ROUNDS = 10;
const MAX_PAGE_FILE_BYTES = 2_000_000;
const MAX_PAGE_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_PAGE_FILES = 30;
const MAX_READ_BYTES = 60_000;

function pageFileRules(project: Project, directory: string): string {
  if (project.type === "vue") {
    return `目标类型：Vue + TS 页面。
文件要求：
- 必须写入 ${directory}/index.vue，使用 <script setup lang="ts">。
- 可将样式拆分到 ${directory}/style.css，并在 SFC 中 import "./style.css"。
- 可将复杂逻辑拆分到 ${directory}/logic.ts，并在 SFC 中导入；复杂渲染组件可使用 .tsx，并确保项目已配置 @vitejs/plugin-vue-jsx。
- 如页面有自定义脚本，必须完整写入 index.vue 的 <script setup lang="ts"> 或同目录 logic.ts，并在组件中实际执行；不能省略、截断或只留 TODO。
- 必须额外写入 ${directory}/preview.html：一个静态、可独立打开的 HTML 预览，内联 CSS/JS，展示该页面构建后的最终外观；它只用于应用内构建产物预览，不参与 Vue 运行时代码。
- 只允许写入 ${directory}/ 下的文件；不要修改其他页面或共享代码，除非页面必须引用已有共享组件。
- 页面应作为 Vue 组件可被现有路由或 App.vue 直接使用。`;
  }
  return `目标类型：HTML + JS 页面。
文件要求：
- 必须写入 ${directory}/index.html。
- 样式写入 ${directory}/style.css，脚本写入 ${directory}/script.js（如需要）。
- 如页面有自定义脚本，必须完整写入 script.js 并在 index.html 中通过 <script src="./script.js" defer></script> 引用；不能省略、截断或只留 TODO。TypeScript 脚本需转写为行为等价的 JavaScript。
- index.html 通过相对路径引用 ./style.css 和 ./script.js。
- 只允许写入 ${directory}/ 下的文件。
- 页面应能直接由浏览器打开，并保持响应式；可以引用同目录 assets/ 资源。`;
}

function systemPrompt(
  project: Project,
  slug: string,
  directory: string,
): string {
  return `你是资深网页设计师和前端工程师。你的任务是根据 Spark Pages 的页面 XML，构建当前页面的代码文件。

工作方式：
1. 先使用 read_page_file 读取需要修改的现有页面文件；首次构建可以跳过读取。
2. 使用 write_page_file 写入或覆盖页面文件；一次回复可以调用多个工具写入多个文件。
3. 所有文件写完后调用 finish_page，summary 用一句中文概括结果。
4. 不要只输出 JSON、Markdown 代码块或文字说明来代替文件写入。
5. HTML、CSS、JS、Vue、TS 等文件必须分开存放，不要把所有内容塞进一个文件（Vue SFC 自身的 template/script/style 除外）。

${pageFileRules(project, directory)}

页面与视觉要求：
1. 保留 XML 中所有文案、模块内容、视觉层级、主题色、字体感觉、圆角、间距和页面尺寸意图。
2. 不要机械复刻 XML 的绝对坐标；使用响应式/流式布局，同时保持设计意图。
3. 实现 XML 中的 animations、keyframes、animation-trigger、anchor-x/anchor-y 和 custom-script。页面脚本必须完整保留并实际执行，不能省略、截断或只留 TODO；HTML 项目写入 script.js（TypeScript 转写为等价 JavaScript），Vue 项目写入 <script setup lang="ts"> 或 logic.ts。
   animation-trigger 必须控制动画播放时机：click 绑定点击，hover 绑定 mouseenter，condition 监视指定组件值并按大于/等于/小于比较，custom 执行 code 并读取布尔返回值；未触发前保持动画初始状态。
4. core.image 模块的 src 已经指向页面目录下的 ./assets/images/ 真实构建资源，必须原样使用该路径，不要替换成占位图、外链或 data URL，也不要删除图片；其他本地资源不要引用不存在的文件。
5. 页面应当响应式、可访问、无控制台错误。
6. 当前页面 slug 为 ${slug}，项目类型是 ${projectTypeLabel(project)}。`;
}

function fallbackSystemPrompt(
  project: Project,
  slug: string,
  directory: string,
): string {
  if (project.type === "vue") {
    return `请把以下 Spark Pages 页面设计转换为一个 Vue 3 + TypeScript 单文件组件。
只输出 SFC 代码，不要 Markdown 代码围栏或解释。必须包含 <template>、<script setup lang="ts"> 和 <style scoped>（可选）。
保留 XML 的文案、视觉层级、主题色、字体、动画和响应式设计。模块的 id 属性请保留为对应元素的 HTML id（Vue 中也可用 ref），以便页面脚本通过 getElementById 访问。页面 slug 为 ${slug}，文件将保存为 ${directory}/index.vue。`;
  }
  return `请把以下 Spark Pages 页面设计转换为一个完整、独立的 HTML 页面。
只输出完整 HTML 文档，不要 Markdown 代码围栏或解释。CSS 和 JS 可以内联，也可以按 ${directory}/style.css、${directory}/script.js 的约定分文件说明。
保留 XML 的文案、视觉层级、主题色、字体、动画和响应式设计。模块的 id 属性请保留为对应元素的 id，以便页面脚本通过 getElementById 访问。页面 slug 为 ${slug}，文件将保存到 ${directory}/。`;
}

function moduleCatalog(page: Page): string {
  const used = new Set(page.modules.map((module) => module.type));
  return listModuleDefinitions()
    .filter((definition) => used.has(definition.type))
    .map(
      (definition) =>
        `- ${definition.type}（${definition.label}）：${definition.ai?.description ?? definition.description}`,
    )
    .join("\n");
}

function pageScriptPrompt(
  project: Project,
  page: Page,
  directory: string,
): string {
  const code = page.customScript?.trim();
  if (!code) {
    return "页面脚本：当前页面没有自定义脚本。";
  }
  const language =
    page.scriptLanguage === "typescript" ? "typescript" : "javascript";
  const fence = language === "typescript" ? "ts" : "js";
  const target =
    project.type === "vue"
      ? `${directory}/index.vue 的 <script setup lang="ts">，或 ${directory}/logic.ts`
      : `${directory}/script.js`;
  const note =
    project.type === "html" && language === "typescript"
      ? "\n注意：HTML 项目不能直接运行 TypeScript，请转写为行为等价的 JavaScript 后写入 script.js。"
      : "";
  return `页面脚本（必须完整保留到构建产物，不能省略、截断或只留 TODO）：
语言：${language}
写入位置：${target}${note}
\`\`\`${fence}
${page.customScript}
\`\`\``;
}

function existingFilesPrompt(files: string[]): string {
  if (files.length === 0) {
    return "当前页面还没有代码文件。";
  }
  return `项目现有文件（可用 read_page_file 读取）：
${files.slice(0, 120).map((path) => `- ${path}`).join("\n")}`;
}

export function buildPageMessages(
  project: Project,
  page: Page,
  instruction: string,
  existingFiles: string[] = [],
): ChatMessage[] {
  const slug = pageSlug(project, page);
  const directory = pageCodeDirectory(project, slug);
  const userPrompt = `${projectSettingsSummary(project)}

${pageSettingsSummary(project, page, slug)}

${existingFilesPrompt(existingFiles)}

使用到的模块说明：
${moduleCatalog(page) || "无"}

${pageScriptPrompt(project, page, directory)}

用户额外的构建要求：
${instruction.trim() || "无，请按页面 XML 设计生成高质量页面"}

页面 XML：
${serializeProject({ ...project, pages: [page] })}`;

  return [
    { role: "system", content: systemPrompt(project, slug, directory) },
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

function pageDirectory(project: Project, page: Page): string {
  return pageCodeDirectory(project, pageSlug(project, page));
}

function validatePageFiles(
  project: Project,
  page: Page,
  files: BuiltPageFile[],
): void {
  const directory = pageDirectory(project, page);
  const required = `${directory}/${project.type === "vue" ? "index.vue" : "index.html"}`;
  if (!files.some((file) => file.path === required)) {
    throw new Error(`页面构建缺少 ${required}`);
  }
  if (project.type === "vue") {
    if (!files.some((file) => file.path.endsWith(".vue"))) {
      throw new Error("Vue 页面构建没有生成 .vue 文件");
    }
    if (!files.some((file) => file.path === `${directory}/preview.html`)) {
      throw new Error(`Vue 页面构建缺少构建产物预览 ${directory}/preview.html`);
    }
    if (page.customScript?.trim()) {
      const sfc = files.find((file) => file.path === `${directory}/index.vue`);
      const hasInlineScript = Boolean(
        sfc && /<script[\s>]/i.test(sfc.content),
      );
      const hasLogicFile = files.some(
        (file) => file.path === `${directory}/logic.ts`,
      );
      if (!hasInlineScript && !hasLogicFile) {
        throw new Error(
          `Vue 页面缺少完整页面脚本（${directory}/index.vue 的 <script setup> 或 logic.ts）`,
        );
      }
    }
    return;
  }
  if (page.customScript?.trim()) {
    const script = files.find(
      (file) => file.path === `${directory}/script.js`,
    );
    if (!script || !script.content.trim()) {
      throw new Error(`页面构建缺少完整页面脚本 ${directory}/script.js`);
    }
    const pageHtml = files.find(
      (file) => file.path === `${directory}/index.html`,
    );
    if (!pageHtml || !pageHtml.content.includes("script.js")) {
      throw new Error(
        `页面构建的 index.html 没有引用 ${directory}/script.js`,
      );
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`缺少字符串参数 ${key}`);
  }
  return value;
}

function absoluteProjectPath(root: string, path: string): string {
  return `${root.replace(/[\\/]+$/, "")}/${path}`;
}

interface PageBuildState {
  project: Project;
  page: Page;
  directory: string;
  files: Map<string, string>;
  sizes: Map<string, number>;
  bytes: number;
  summary: string;
  finished: boolean;
}

interface PageBuildToolResult {
  ok: boolean;
  summary: string;
  result?: unknown;
  modelResult?: unknown;
  error?: string;
  finished?: boolean;
}

function pageBuildFailure(error: unknown): PageBuildToolResult {
  return {
    ok: false,
    summary: "页面工具调用失败",
    error: error instanceof Error ? error.message : "工具执行失败",
  };
}

function buildPageFiles(state: PageBuildState): BuiltPageFile[] {
  return Array.from(state.files.entries()).map(([path, content]) => ({
    path,
    content,
  }));
}

async function executePageBuildTool(
  name: string,
  args: Record<string, unknown>,
  state: PageBuildState,
  root: string,
): Promise<PageBuildToolResult> {
  if (name === "read_page_file") {
    try {
      const path = normalizePath(requiredString(args, "path"));
      const content = await invoke<string>("read_text_file", {
        path: absoluteProjectPath(root, path),
      });
      const truncated =
        content.length > MAX_READ_BYTES
          ? `${content.slice(0, MAX_READ_BYTES)}\n…（文件已截断）`
          : content;
      return {
        ok: true,
        summary: `读取 ${path}（${formatBytes(new TextEncoder().encode(content).length)}）`,
        result: {
          path,
          bytes: new TextEncoder().encode(content).length,
          preview: truncated.slice(0, 500),
        },
        modelResult: { path, content: truncated },
      };
    } catch (error) {
      return pageBuildFailure(error);
    }
  }

  if (name === "write_page_file") {
    try {
      const path = normalizePath(requiredString(args, "path"));
      if (path.toLowerCase().endsWith(".spark")) {
        throw new Error("不能覆盖 Spark Pages 项目文件");
      }
      if (!path.startsWith(`${state.directory}/`)) {
        throw new Error(`页面文件必须位于 ${state.directory}/ 目录内`);
      }
      const content = requiredString(args, "content");
      const bytes = new TextEncoder().encode(content).length;
      if (bytes > MAX_PAGE_FILE_BYTES) {
        throw new Error(`文件过大：${path}（${formatBytes(bytes)}）`);
      }
      const previousBytes = state.sizes.get(path) ?? 0;
      if (!state.files.has(path) && state.files.size >= MAX_PAGE_FILES) {
        throw new Error(`文件数量过多（最多 ${MAX_PAGE_FILES} 个）`);
      }
      const nextBytes = state.bytes - previousBytes + bytes;
      if (nextBytes > MAX_PAGE_TOTAL_BYTES) {
        throw new Error("页面文件总大小超出限制");
      }
      const existed = state.files.has(path);
      state.files.set(path, content);
      state.sizes.set(path, bytes);
      state.bytes = nextBytes;
      return {
        ok: true,
        summary: `${existed ? "更新" : "写入"} ${path}（${formatBytes(bytes)}）`,
        result: { path, bytes, files: state.files.size },
      };
    } catch (error) {
      return pageBuildFailure(error);
    }
  }

  if (name === "finish_page") {
    try {
      const files = buildPageFiles(state);
      validatePageFiles(state.project, state.page, files);
      state.summary =
        typeof args.summary === "string" ? args.summary.trim() : "";
      state.finished = true;
      return {
        ok: true,
        summary: `页面文件已就绪（${files.length} 个文件）`,
        result: { files: files.length },
        finished: true,
      };
    } catch (error) {
      return pageBuildFailure(error);
    }
  }

  return pageBuildFailure(new Error(`未知工具：${name}`));
}

function summarizePageArgs(
  name: string,
  args: Record<string, unknown>,
  raw: string,
): string {
  if (name === "read_page_file") {
    return `path: ${typeof args.path === "string" ? args.path : ""}`;
  }
  if (name === "write_page_file") {
    const path = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : "";
    const preview =
      content.length > 500 ? `${content.slice(0, 500)}\n…` : content;
    return `path: ${path}\nbytes: ${new TextEncoder().encode(content).length}\n\n${preview}`;
  }
  if (name === "finish_page") {
    return `summary: ${typeof args.summary === "string" ? args.summary : ""}`;
  }
  return raw.slice(0, 2000);
}

function extractVueSfc(text: string): string {
  const fenced = text.match(/```(?:vue|html)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  if (!/<template[\s>]/i.test(candidate)) {
    throw new Error("AI 没有返回有效的 Vue 组件");
  }
  return candidate;
}

function extractHtmlDocument(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) {
    throw new Error("AI 没有返回有效的 HTML 页面");
  }
  return candidate.slice(start);
}

function fallbackFiles(
  project: Project,
  page: Page,
  text: string,
): BuiltPageFile[] {
  const directory = pageDirectory(project, page);
  if (project.type === "vue") {
    return [{ path: `${directory}/index.vue`, content: extractVueSfc(text) }];
  }
  const html = extractHtmlDocument(text);
  const files: BuiltPageFile[] = [
    { path: `${directory}/index.html`, content: html },
  ];
  if (page.customScript?.trim() && page.scriptLanguage !== "typescript") {
    const referenced = /<script[^>]+src=["'][^"']*script\.js["']/i.test(html);
    files[0].content = referenced
      ? html
      : html.replace(
          /<\/body>/i,
          `  <script src="./script.js" defer></script>\n</body>`,
        );
    files.push({
      path: `${directory}/script.js`,
      content: page.customScript,
    });
  }
  return files;
}

function isToolCallingUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /tool|function|工具|函数/i.test(message) &&
    /400|不支持|unsupported|not support|invalid/i.test(message)
  );
}

export async function buildPageWithAi(
  project: Project,
  page: Page,
  config: AiConfig,
  instruction: string,
  options: PageBuildOptions,
): Promise<BuiltPage> {
  const callbacks = options.callbacks ?? {};
  const existingFiles = options.existingFiles ?? [];
  const directory = pageDirectory(project, page);
  const messages: ChatMessage[] = buildPageMessages(
    project,
    page,
    instruction,
    existingFiles,
  );
  const state: PageBuildState = {
    project,
    page,
    directory,
    files: new Map(),
    sizes: new Map(),
    bytes: 0,
    summary: "",
    finished: false,
  };

  for (let round = 0; round < MAX_PAGE_BUILD_ROUNDS; round += 1) {
    callbacks.onStatus?.(
      round === 0
        ? "AI 正在分析页面设计稿和现有代码…"
        : `AI 正在继续完善页面（第 ${round + 1} 轮）…`,
    );
    let result: ChatCompletionResult;
    try {
      result = await chatCompletion(config, messages, {
        temperature: Math.min(config.temperature, 0.8),
        maxTokens: config.maxTokens,
        tools: PAGE_BUILD_TOOLS,
        toolChoice: "auto",
      });
    } catch (error) {
      if (
        round === 0 &&
        state.files.size === 0 &&
        isToolCallingUnsupported(error)
      ) {
        callbacks.onStatus?.(
          "当前模型不支持工具调用，正在回退为直接生成页面文件…",
        );
        const fallbackMessages = buildPageMessages(
          project,
          page,
          instruction,
          existingFiles,
        );
        fallbackMessages[0] = {
          role: "system",
          content: fallbackSystemPrompt(
            project,
            pageSlug(project, page),
            directory,
          ),
        };
        const fallbackResult = await chatCompletion(config, fallbackMessages, {
          temperature: Math.min(config.temperature, 0.8),
          maxTokens: config.maxTokens,
        });
        const fallbackText = extractMessageText(fallbackResult.message);
        if (fallbackText.trim()) {
          callbacks.onAssistantMessage?.(fallbackText);
        }
        const files = fallbackFiles(project, page, fallbackText);
        validatePageFiles(project, page, files);
        return { summary: "页面已构建", files };
      }
      throw error;
    }

    const text = extractMessageText(result.message).trim();
    if (text) {
      callbacks.onAssistantMessage?.(text);
    }
    const toolCalls = result.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      if (state.files.size > 0) {
        const files = buildPageFiles(state);
        validatePageFiles(project, page, files);
        return {
          summary: state.summary || text || "页面已构建",
          files,
        };
      }
      if (text) {
        const files = fallbackFiles(project, page, text);
        validatePageFiles(project, page, files);
        return { summary: "页面已构建", files };
      }
      throw new Error("AI 没有返回页面文件或调用页面工具");
    }

    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((call) => ({
        ...call,
        function: { ...call.function, arguments: "{}" },
      })),
    });

    for (let index = 0; index < toolCalls.length; index += 1) {
      const call = toolCalls[index];
      const name = call.function.name;
      const label = PAGE_BUILD_TOOL_LABELS[name] ?? name;
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
        ? pageBuildFailure(new Error(parseError))
        : await executePageBuildTool(name, args, state, options.root);
      const trace: ChatToolTrace = {
        id: call.id || nanoid(),
        name,
        label,
        args: summarizePageArgs(name, args, call.function.arguments),
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
    throw new Error("AI 没有生成页面文件，请重试或调整构建要求。");
  }
  const files = buildPageFiles(state);
  validatePageFiles(project, page, files);
  return {
    summary: state.summary || "页面已构建",
    files,
  };
}

function inlinePageAssets(
  files: BuiltPageFile[],
  fileName = "index.html",
): string | null {
  const htmlFile = files.find((file) => file.path.endsWith(`/${fileName}`));
  if (!htmlFile) {
    return null;
  }
  const directory = htmlFile.path.slice(0, htmlFile.path.lastIndexOf("/") + 1);
  const byName = new Map(
    files
      .filter((file) => file.path.startsWith(directory))
      .map((file) => [file.path.slice(directory.length), file] as const),
  );
  let html = htmlFile.content;
  html = html.replace(
    /<link[^>]*href=["']\.?\/?([^"']+\.css)["'][^>]*>/gi,
    (match, href: string) => {
      const file = byName.get(href);
      return file ? `<style>\n${file.content}\n</style>` : match;
    },
  );
  html = html.replace(
    /<script[^>]*src=["']\.?\/?([^"']+\.js)["'][^>]*><\/script>/gi,
    (match, src: string) => {
      const file = byName.get(src);
      return file ? `<script>\n${file.content}\n</script>` : match;
    },
  );
  return html;
}

export function buildPagePreviewHtml(
  project: Project,
  page: Page,
  files: BuiltPageFile[],
): string | null {
  const directory = pageDirectory(project, page);
  const pageFiles = files.map((file) => ({
    ...file,
    path: file.path.startsWith(directory)
      ? file.path
      : `${directory}/${file.path}`,
  }));
  return inlinePageAssets(
    pageFiles,
    project.type === "vue" ? "preview.html" : "index.html",
  );
}

export async function writePageFiles(
  root: string,
  files: BuiltPageFile[],
): Promise<string> {
  return invoke<string>("write_build_files", { root, files });
}
