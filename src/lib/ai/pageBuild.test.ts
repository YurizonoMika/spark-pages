import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    chatCompletion: vi.fn(),
  };
});

import { defaultProject } from "../../model/defaults";
import type { ChatToolTrace } from "../../store/aiChatStore";
import { chatCompletion } from "./client";
import {
  buildPageMessages,
  buildPagePreviewHtml,
  buildPageWithAi,
} from "./pageBuild";
import { pageCodeDirectory, pageSlug } from "./projectContext";

const config = {
  baseUrl: "http://mock/v1",
  model: "mock-page-build",
  temperature: 0.3,
  maxTokens: 4096,
};

const html = `<!doctype html>
<html>
<head><title>Demo</title><link rel="stylesheet" href="./style.css" /></head>
<body><h1>Built by AI</h1><script src="./script.js"></script></body>
</html>`;

function toolCall(name: string, args: Record<string, unknown>) {
  return {
    id: `call_${name}_${Math.random().toString(36).slice(2)}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

describe("AI page build", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("includes full project settings, page settings and only the active page XML", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const other = {
      ...page,
      id: "page_other",
      title: "其他页面唯一标题",
    };
    project.pages.push(other);

    const messages = buildPageMessages(project, page, "使用深色主题", [
      "index.html",
      "pages/home/style.css",
    ]);
    const user = messages[1].content ?? "";

    expect(user).toContain(project.name);
    expect(user).toContain("完整项目设置");
    expect(user).toContain(page.title);
    expect(user).toContain("使用深色主题");
    expect(user).toContain("页面 XML");
    expect(user).toContain("pages/home/style.css");
    expect(user).toContain("其他页面唯一标题");
    expect(user).not.toContain('id="page_other"');
  });

  it("includes the complete page script in the build prompt", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = 'document.getElementById("cta")?.focus();';
    page.scriptLanguage = "javascript";

    const messages = buildPageMessages(project, page, "", []);
    const user = messages[1].content ?? "";

    expect(user).toContain(page.customScript);
    expect(user).toContain("页面脚本（必须完整保留");
    expect(user).toContain("script.js");
  });

  it("writes split page files through read/write tools", async () => {
    const mocked = vi.mocked(chatCompletion);
    const project = defaultProject();
    const page = project.pages[0];
    const directory = pageCodeDirectory(project, pageSlug(project, page));
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "正在构建设计稿。",
        tool_calls: [
          toolCall("write_page_file", {
            path: `${directory}/index.html`,
            content: html,
          }),
          toolCall("write_page_file", {
            path: `${directory}/style.css`,
            content: "body{color:#6750a4}",
          }),
          toolCall("write_page_file", {
            path: `${directory}/script.js`,
            content: 'console.log("ready")',
          }),
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "页面已完成。",
        tool_calls: [
          toolCall("finish_page", { summary: "AI 生成了演示页面" }),
        ],
      },
    } as never);

    const traces: ChatToolTrace[] = [];
    const assistantMessages: string[] = [];
    const result = await buildPageWithAi(project, page, config, "", {
      root: "/tmp/demo",
      callbacks: {
        onTool: (trace) => traces.push(trace),
        onAssistantMessage: (text) => assistantMessages.push(text),
      },
    });

    expect(result.summary).toBe("AI 生成了演示页面");
    expect(result.files.map((file) => file.path)).toEqual([
      `${directory}/index.html`,
      `${directory}/style.css`,
      `${directory}/script.js`,
    ]);
    expect(traces.map((trace) => trace.name)).toEqual([
      "write_page_file",
      "write_page_file",
      "write_page_file",
      "finish_page",
    ]);
    expect(traces.every((trace) => trace.status === "success")).toBe(true);
    expect(assistantMessages).toEqual(["正在构建设计稿。", "页面已完成。"]);
    const preview = buildPagePreviewHtml(project, page, result.files);
    expect(preview).toContain("<style>");
    expect(preview).toContain('console.log("ready")');
  });

  it("builds a Vue SFC page file", async () => {
    const project = defaultProject();
    project.type = "vue";
    project.template = "vite-vue-ts";
    const page = project.pages[0];
    const directory = pageCodeDirectory(project, pageSlug(project, page));
    const sfc =
      '<template><h1>Vue page</h1></template>\n<script setup lang="ts">const x = 1;</script>';

    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "正在构建 Vue 页面。",
        tool_calls: [
          toolCall("write_page_file", {
            path: `${directory}/index.vue`,
            content: sfc,
          }),
          toolCall("write_page_file", {
            path: `${directory}/preview.html`,
            content: "<!doctype html><html><body><h1>Vue page</h1></body></html>",
          }),
        ],
      },
    } as never);
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: null,
        tool_calls: [toolCall("finish_page", { summary: "Vue 页面完成" })],
      },
    } as never);

    const result = await buildPageWithAi(project, page, config, "", {
      root: "/tmp/demo",
    });

    expect(result.files[0].path).toBe(`${directory}/index.vue`);
    expect(result.files[0].content).toContain("Vue page");
    expect(buildPagePreviewHtml(project, page, result.files)).toContain(
      "Vue page",
    );
  });

  it("accepts raw HTML from models that ignore tools", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: `这里是页面：\n\`\`\`html\n${html}\n\`\`\``,
      },
    } as never);

    const project = defaultProject();
    const page = project.pages[0];
    const directory = pageCodeDirectory(project, pageSlug(project, page));
    const result = await buildPageWithAi(project, page, config, "", {
      root: "/tmp/demo",
    });
    expect(result.files[0].path).toBe(`${directory}/index.html`);
    expect(result.files[0].content).toContain("Built by AI");
    expect(result.summary).toBe("页面已构建");
  });

  it("falls back to direct generation when tools are unsupported", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockRejectedValueOnce(
      new Error("模型请求失败 (400): tools are not supported"),
    );
    mocked.mockResolvedValueOnce({
      message: { role: "assistant", content: html },
    } as never);

    const statuses: string[] = [];
    const project = defaultProject();
    const page = project.pages[0];
    const result = await buildPageWithAi(project, page, config, "", {
      root: "/tmp/demo",
      callbacks: { onStatus: (status) => statuses.push(status) },
    });

    expect(result.files[0].content).toContain("Built by AI");
    expect(statuses.some((status) => status.includes("回退"))).toBe(true);
    expect(mocked.mock.calls[1][2]?.tools).toBeUndefined();
  });

  it("rejects responses without page files", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: { role: "assistant", content: "我已经完成了设计。" },
    } as never);

    const project = defaultProject();
    await expect(
      buildPageWithAi(project, project.pages[0], config, "", {
        root: "/tmp/demo",
      }),
    ).rejects.toThrow(/HTML/);
  });
});
