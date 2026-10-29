import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    chatCompletion: vi.fn(),
  };
});

import { defaultProject } from "../../model/defaults";
import type { Project } from "../../model/types";
import type { ChatToolTrace } from "../../store/aiChatStore";
import { chatCompletion } from "./client";
import {
  generateProjectFiles,
  parseGeneratedProject,
  validateProjectFiles,
} from "./build";

function payload(files: Array<{ path: string; content: string }>): string {
  return JSON.stringify({ summary: "done", files });
}

const packageJson = JSON.stringify({
  scripts: { dev: "vite" },
  dependencies: { vue: "^3.5.0" },
  devDependencies: { vite: "^7.0.0" },
});

const config = {
  baseUrl: "http://mock/v1",
  model: "mock-build",
  temperature: 0.2,
  maxTokens: 4096,
};

function htmlProject(): Project {
  const project = defaultProject();
  project.type = "html";
  project.template = "static";
  return project;
}

function vueProject(): Project {
  const project = defaultProject();
  project.type = "vue";
  project.template = "vite-vue-ts";
  return project;
}

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

describe("AI project output", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("parses a valid HTML + JS project payload", () => {
    const project = htmlProject();
    const result = parseGeneratedProject(
      project,
      payload([
        { path: "index.html", content: "<html></html>" },
        { path: "pages/home/index.html", content: "<html></html>" },
        { path: "pages/home/style.css", content: "body{}" },
      ]),
    );
    expect(result.summary).toBe("done");
    expect(result.files.map((file) => file.path)).toEqual([
      "index.html",
      "pages/home/index.html",
      "pages/home/style.css",
    ]);
  });

  it("parses a valid Vue + TS project payload", () => {
    const project = vueProject();
    const result = parseGeneratedProject(
      project,
      payload([
        { path: "package.json", content: packageJson },
        { path: "index.html", content: "<html></html>" },
        { path: "src/main.ts", content: "import './style.css'" },
        { path: "src/App.vue", content: "<template />" },
        { path: "src/pages/首页/index.vue", content: "<template />" },
        { path: "src/pages/首页/preview.html", content: "<html></html>" },
      ]),
    );
    expect(result.files).toHaveLength(6);
  });

  it("parses JSON wrapped in a code fence", () => {
    const project = htmlProject();
    const fenced =
      "```json\n" +
      payload([
        { path: "index.html", content: "<html></html>" },
      ]) +
      "\n```";
    const result = parseGeneratedProject(project, fenced);
    expect(result.files).toHaveLength(1);
  });

  it("rejects unsafe paths", () => {
    const project = htmlProject();
    expect(() =>
      parseGeneratedProject(
        project,
        payload([
          { path: "index.html", content: "<html></html>" },
          { path: "../secret.txt", content: "nope" },
        ]),
      ),
    ).toThrow(/不安全/);
  });

  it("rejects dot path segments", () => {
    const project = htmlProject();
    expect(() =>
      parseGeneratedProject(
        project,
        payload([
          { path: "index.html", content: "<html></html>" },
          { path: "src/./main.js", content: "nope" },
        ]),
      ),
    ).toThrow(/不安全/);
  });

  it("requires a root index.html", () => {
    const project = htmlProject();
    expect(() =>
      parseGeneratedProject(
        project,
        payload([{ path: "pages/home/index.html", content: "<html></html>" }]),
      ),
    ).toThrow(/index.html/);
  });

  it("requires Vue project files and a dev script", () => {
    const project = vueProject();
    expect(() =>
      validateProjectFiles(project, [
        { path: "index.html", content: "<html></html>" },
      ]),
    ).toThrow(/package.json/);
    expect(() =>
      validateProjectFiles(project, [
        { path: "package.json", content: packageJson },
        { path: "index.html", content: "<html></html>" },
        { path: "src/main.ts", content: "import './style.css'" },
        { path: "src/App.vue", content: "<template />" },
        { path: "src/pages/首页/index.vue", content: "<template />" },
        { path: "src/pages/首页/preview.html", content: "<html></html>" },
      ]),
    ).not.toThrow();
    expect(() =>
      validateProjectFiles(project, [
        {
          path: "package.json",
          content: JSON.stringify({ scripts: {}, dependencies: { vue: "3" } }),
        },
        { path: "index.html", content: "<html></html>" },
        { path: "src/main.ts", content: "import './style.css'" },
        { path: "src/App.vue", content: "<template />" },
        { path: "src/pages/首页/index.vue", content: "<template />" },
        { path: "src/pages/首页/preview.html", content: "<html></html>" },
      ]),
    ).toThrow(/scripts.dev/);
  });

  it("writes project files through build agent tools", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "正在创建基础文件。",
        tool_calls: [
          toolCall("write_project_file", {
            path: "index.html",
            content: "<html><body>demo</body></html>",
          }),
          toolCall("write_project_file", {
            path: "pages/home/index.html",
            content: "<html><body>home</body></html>",
          }),
          toolCall("write_project_file", {
            path: "pages/home/style.css",
            content: "body{color:red}",
          }),
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "项目已完成。",
        tool_calls: [
          toolCall("finish_project", { summary: "生成了一个演示项目" }),
        ],
      },
    } as never);

    const assistantMessages: string[] = [];
    const traces: ChatToolTrace[] = [];
    const result = await generateProjectFiles(
      htmlProject(),
      config,
      "做一个演示页",
      "/tmp/demo",
      [],
      {
        onAssistantMessage: (text) => assistantMessages.push(text),
        onTool: (trace) => traces.push(trace),
      },
    );

    expect(result.summary).toBe("生成了一个演示项目");
    expect(result.files.map((file) => file.path)).toEqual([
      "index.html",
      "pages/home/index.html",
      "pages/home/style.css",
    ]);
    expect(assistantMessages).toEqual([
      "正在创建基础文件。",
      "项目已完成。",
    ]);
    expect(traces).toHaveLength(4);
    expect(traces.every((trace) => trace.status === "success")).toBe(true);
    expect(traces[0].summary).toContain("index.html");
    expect(mocked.mock.calls[0][2]?.tools).toBeDefined();
  });

  it("falls back to JSON when the endpoint rejects tool calling", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockRejectedValueOnce(
      new Error("模型请求失败 (400): tools are not supported"),
    );
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: payload([
          { path: "index.html", content: "<html></html>" },
          { path: "pages/home/index.html", content: "<html></html>" },
        ]),
      },
    } as never);

    const statuses: string[] = [];
    const result = await generateProjectFiles(
      htmlProject(),
      config,
      "",
      "/tmp/demo",
      [],
      { onStatus: (status) => statuses.push(status) },
    );

    expect(result.files).toHaveLength(2);
    expect(statuses.some((status) => status.includes("回退"))).toBe(true);
    expect(mocked.mock.calls[1][2]?.tools).toBeUndefined();
  });

  it("falls back to JSON output when the model does not use tools", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: payload([
          { path: "index.html", content: "<html></html>" },
          { path: "pages/home/index.html", content: "<html></html>" },
        ]),
      },
    } as never);

    const result = await generateProjectFiles(
      htmlProject(),
      config,
      "",
      "/tmp/demo",
    );
    expect(result.summary).toBe("done");
    expect(result.files).toHaveLength(2);
  });

  it("returns tool errors to the model and reports failed traces", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          toolCall("write_project_file", {
            path: "../outside.txt",
            content: "nope",
          }),
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "路径已修正。",
        tool_calls: [
          toolCall("write_project_file", {
            path: "index.html",
            content: "<html></html>",
          }),
          toolCall("write_project_file", {
            path: "pages/home/index.html",
            content: "<html></html>",
          }),
          toolCall("finish_project", {}),
        ],
      },
    } as never);

    const traces: ChatToolTrace[] = [];
    const result = await generateProjectFiles(
      htmlProject(),
      config,
      "",
      "/tmp/demo",
      [],
      { onTool: (trace) => traces.push(trace) },
    );

    expect(result.files).toHaveLength(2);
    expect(traces.some((trace) => trace.status === "error")).toBe(true);
    expect(traces.find((trace) => trace.status === "error")?.error).toContain(
      "不安全",
    );
  });
});
