import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, chatCompletion: vi.fn() };
});

import { invoke } from "@tauri-apps/api/core";
import { runAgentTurn } from "./agent";
import { chatCompletion } from "./client";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";

const config = {
  baseUrl: "http://mock/v1",
  model: "mock-agent",
  temperature: 0.2,
  maxTokens: 4096,
};

function offeredToolNames(callIndex: number): string[] {
  const tools = vi.mocked(chatCompletion).mock.calls[callIndex][2]?.tools;
  return Array.isArray(tools)
    ? tools.map((tool) => {
        const definition = tool as {
          function?: { name?: string };
        };
        return definition.function?.name ?? "";
      })
    : [];
}

describe("agent document scope", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
    vi.mocked(invoke).mockReset();
    useEditorStore.getState().newProject();
    useEditorStore.getState().setProjectFolder("/tmp/agent-files");
  });

  it("writes the page script into the XML design document", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "正在更新页面脚本。",
          tool_calls: [
            {
              id: "call_script",
              type: "function",
              function: {
                name: "write_page_script",
                arguments: JSON.stringify({
                  code: "const count: number = 1;",
                  language: "typescript",
                }),
              },
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "页面脚本已更新。" },
      } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "把页面脚本改成 TypeScript",
      selectedModuleIds: [],
    });

    expect(result.content).toBe("页面脚本已更新。");
    expect(result.traces[0]).toMatchObject({
      name: "write_page_script",
      status: "success",
    });
    const page = selectActivePage(useEditorStore.getState());
    expect(page.customScript).toBe("const count: number = 1;");
    expect(page.scriptLanguage).toBe("typescript");
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(invoke).not.toHaveBeenCalled();

    const tools = offeredToolNames(0);
    expect(tools).toContain("write_page_script");
    expect(tools).toContain("read_page_script");
    expect(tools).not.toContain("write_page_file");
    expect(tools).not.toContain("read_page_file");
    expect(tools).not.toContain("list_page_files");
  });

  it("rejects code file tools while a design page is active", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "尝试写入文件。",
          tool_calls: [
            {
              id: "call_file",
              type: "function",
              function: {
                name: "write_page_file",
                arguments: JSON.stringify({
                  path: "pages/首页/index.html",
                  content: "<h1>nope</h1>",
                }),
              },
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "已跳过。" },
      } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "改一下 index.html",
      selectedModuleIds: [],
    });

    expect(result.traces[0].status).toBe("error");
    expect(result.traces[0].error).toContain("不允许调用工具");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("only exposes the active file tools for a file tab", async () => {
    const path = "/tmp/agent-files/pages/首页/index.html";
    useEditorStore.getState().openFileTab({
      path,
      name: "index.html",
      language: "html",
      content: "<h1>old</h1>",
      savedContent: "<h1>old</h1>",
    });
    useEditorStore.getState().setFileView("code");
    vi.mocked(invoke).mockResolvedValueOnce(null);
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "正在更新文件。",
          tool_calls: [
            {
              id: "call_current",
              type: "function",
              function: {
                name: "write_current_file",
                arguments: JSON.stringify({ content: "<h1>new</h1>" }),
              },
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "文件已更新。" },
      } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "把标题改成 new",
      selectedModuleIds: [],
    });

    expect(result.traces[0]).toMatchObject({
      name: "write_current_file",
      status: "success",
    });
    expect(invoke).toHaveBeenCalledWith("write_text_file", {
      path,
      content: "<h1>new</h1>",
    });
    const file = useEditorStore
      .getState()
      .openFiles.find((candidate) => candidate.path === path);
    expect(file?.content).toBe("<h1>new</h1>");
    expect(file?.savedContent).toBe("<h1>new</h1>");

    const tools = offeredToolNames(0);
    expect(tools).toEqual(["read_current_file", "write_current_file"]);
  });

  it("exposes no tools when no document is open", async () => {
    useEditorStore
      .getState()
      .closePageTab(useEditorStore.getState().activePageId);
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "请先打开页面或文件标签页。",
      },
    } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "改一下脚本",
      selectedModuleIds: [],
    });

    expect(result.content).toContain("请先打开");
    expect(result.traces).toHaveLength(0);
    expect(offeredToolNames(0)).toEqual([]);
  });
});
