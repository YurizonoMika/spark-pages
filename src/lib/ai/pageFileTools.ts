import { invoke } from "@tauri-apps/api/core";
import type {
  AgentToolDefinition,
  ToolExecutionResult,
} from "./tools";
import { listProjectFiles, writeBuildFiles } from "./build";
import {
  pageCodeDirectory,
  pageSlug,
} from "./projectContext";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";

export const PAGE_FILE_TOOL_NAMES = new Set([
  "list_page_files",
  "read_page_file",
  "write_page_file",
]);

export const CURRENT_FILE_TOOL_NAMES = new Set([
  "read_current_file",
  "write_current_file",
]);

export const CURRENT_FILE_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_current_file",
      description:
        "读取当前标签页打开的文件全文。只能读取当前文件，不需要也无法指定其他路径。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "write_current_file",
      description:
        "用完整内容写入或覆盖当前标签页打开的文件。只能修改当前文件，写入后直接保存到项目文件夹。",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["content"],
      },
    },
  },
];

const ALLOWED_EXTENSIONS = new Set([
  "html",
  "htm",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "vue",
  "css",
  "scss",
  "less",
  "json",
  "svg",
  "md",
  "txt",
]);

const MAX_READ_CHARS = 120_000;
const MAX_WRITE_BYTES = 2_000_000;

export function isPageFileTool(name: string): boolean {
  return PAGE_FILE_TOOL_NAMES.has(name);
}

export function isCurrentFileTool(name: string): boolean {
  return CURRENT_FILE_TOOL_NAMES.has(name);
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
    throw new Error(`不安全的文件路径：${path}`);
  }
  return normalized;
}

function extensionOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function pageFileContext() {
  const state = useEditorStore.getState();
  const page = selectActivePage(state);
  if (!state.projectFolder) {
    throw new Error("当前没有打开项目文件夹，无法读写页面代码文件");
  }
  const directory = pageCodeDirectory(
    state.project,
    pageSlug(state.project, page),
  );
  return { state, page, folder: state.projectFolder, directory };
}

function requirePagePath(path: string, directory: string): string {
  const normalized = normalizePath(path);
  if (
    normalized !== directory &&
    !normalized.startsWith(`${directory}/`)
  ) {
    throw new Error(`只能访问当前页面目录 ${directory}/ 内的文件`);
  }
  const extension = extensionOf(normalized);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`不支持的文件类型：.${extension || "未知"}`);
  }
  return normalized;
}

function requiredString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`缺少字符串参数 ${key}`);
  }
  return value;
}

function failure(error: unknown): ToolExecutionResult {
  return {
    ok: false,
    summary: "页面文件工具调用失败",
    error: error instanceof Error ? error.message : "页面文件工具调用失败",
  };
}

export async function executePageFileTool(
  name: string,
  rawArgs: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  try {
    const { folder, directory } = pageFileContext();

    if (name === "list_page_files") {
      const entries = await listProjectFiles(folder);
      const files = entries
        .filter(
          (entry) =>
            !entry.isDir &&
            entry.path.startsWith(`${directory}/`) &&
            !entry.path.toLowerCase().endsWith(".spark"),
        )
        .map((entry) => ({ path: entry.path, size: entry.size }));
      return {
        ok: true,
        summary: `读取页面文件目录，共 ${files.length} 个文件`,
        result: { directory, files },
      };
    }

    if (name === "read_page_file") {
      const path = requirePagePath(
        requiredString(rawArgs, "path"),
        directory,
      );
      const content = await invoke<string>("read_text_file", {
        path: `${folder.replace(/[\\/]+$/, "")}/${path}`,
      });
      if (content.includes("\u0000")) {
        throw new Error("不能读取二进制文件");
      }
      const truncated = content.length > MAX_READ_CHARS;
      return {
        ok: true,
        summary: `读取页面文件 ${path}`,
        result: {
          path,
          bytes: new TextEncoder().encode(content).length,
          truncated,
          content: truncated
            ? content.slice(0, MAX_READ_CHARS)
            : content,
        },
      };
    }

    if (name === "write_page_file") {
      const path = requirePagePath(
        requiredString(rawArgs, "path"),
        directory,
      );
      const content = requiredString(rawArgs, "content");
      const bytes = new TextEncoder().encode(content).length;
      if (bytes > MAX_WRITE_BYTES) {
        throw new Error("页面文件超过 2 MB 限制");
      }
      await writeBuildFiles(folder, [{ path, content }]);
      const store = useEditorStore.getState();
      const absolutePath = `${folder.replace(/[\\/]+$/, "")}/${path}`;
      store.markFileTabSaved(absolutePath, content);
      store.bumpFilesVersion();
      return {
        ok: true,
        summary: `写入页面文件 ${path}（${(bytes / 1024).toFixed(1)} KB）`,
        result: { path, bytes },
      };
    }

    return failure(new Error(`未知页面文件工具：${name}`));
  } catch (error) {
    return failure(error);
  }
}

export async function executeCurrentFileTool(
  name: string,
  rawArgs: Record<string, unknown>,
  path: string,
): Promise<ToolExecutionResult> {
  try {
    const store = useEditorStore.getState();
    const file = store.openFiles.find(
      (candidate) => candidate.path === path,
    );
    if (!file) {
      throw new Error("当前文件标签已关闭，无法读写");
    }

    if (name === "read_current_file") {
      const content = file.content;
      const truncated = content.length > MAX_READ_CHARS;
      return {
        ok: true,
        summary: `读取当前文件 ${file.name}`,
        result: {
          path: file.path,
          name: file.name,
          language: file.language,
          dirty: content !== file.savedContent,
          truncated,
          content: truncated ? content.slice(0, MAX_READ_CHARS) : content,
        },
      };
    }

    if (name === "write_current_file") {
      const content = requiredString(rawArgs, "content");
      const bytes = new TextEncoder().encode(content).length;
      if (bytes > MAX_WRITE_BYTES) {
        throw new Error("文件超过 2 MB 限制");
      }
      await invoke("write_text_file", { path: file.path, content });
      store.markFileTabSaved(file.path, content);
      store.bumpFilesVersion();
      return {
        ok: true,
        summary: `写入当前文件 ${file.name}（${(bytes / 1024).toFixed(1)} KB）`,
        result: { path: file.path, bytes },
      };
    }

    return failure(new Error(`未知文件工具：${name}`));
  } catch (error) {
    return failure(error);
  }
}
