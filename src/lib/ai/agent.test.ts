import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    chatCompletion: vi.fn(),
  };
});

import { chatCompletion } from "./client";
import { runAgentTurn } from "./agent";
import { executeAgentTool } from "./tools";
import "../../modules/core";
import { useEditorStore } from "../../store/editorStore";

const config = {
  baseUrl: "http://127.0.0.1:1/v1",
  model: "mock",
  temperature: 0.2,
  maxTokens: 4096,
};

describe("agent runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().newProject();
    vi.clearAllMocks();
  });

  it("executes tool calls and returns the final answer", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "insert_modules",
              arguments: JSON.stringify({
                modules: [
                  {
                    type: "core.heading",
                    x: 64,
                    y: 64,
                    width: 480,
                    height: 128,
                    props: { text: "AI 生成的标题" },
                  },
                ],
              }),
            },
          },
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "已添加标题。",
      },
    } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "添加一个标题",
      selectedModuleIds: [],
    });

    expect(result.content).toBe("已添加标题。");
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].status).toBe("success");
    const modules = useEditorStore.getState().project.pages[0].modules;
    expect(
      modules.some(
        (module) =>
          module.props.text === "AI 生成的标题" &&
          module.type === "core.heading",
      ),
    ).toBe(true);
    expect(mocked).toHaveBeenCalledTimes(2);
    const secondCall = mocked.mock.calls[1][1];
    expect(secondCall.some((message) => message.role === "tool")).toBe(true);
  });

  it("updates modules and theme through tools", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    const update = executeAgentTool("update_module", {
      id,
      patch: { x: 96, y: 96, props: { text: "更新后的文字" } },
    });
    expect(update.ok).toBe(true);
    const theme = executeAgentTool("set_theme", {
      primary: "#006a6a",
    });
    expect(theme.ok).toBe(true);
    const page = useEditorStore.getState().project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);
    expect(module?.x).toBe(96);
    expect(module?.props.text).toBe("更新后的文字");
    expect(useEditorStore.getState().project.theme.primary).toBe("#006a6a");
  });

  it("edits preset animations and keyframe tracks through tools", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    const preset = executeAgentTool("set_preset_animation", {
      target: "module",
      moduleId: id,
      entrance: "fade-in",
      duration: 800,
    });
    expect(preset.ok).toBe(true);
    const track = executeAgentTool("add_animation_track", {
      target: "module",
      moduleId: id,
      property: "opacity",
      time: 0,
      value: 1,
      easing: "linear",
    });
    expect(track.ok).toBe(true);
    const keyframe = executeAgentTool("add_animation_keyframe", {
      target: "module",
      moduleId: id,
      property: "opacity",
      time: 1000,
      value: 0,
      easing: "ease-out",
    });
    expect(keyframe.ok).toBe(true);
    const keyframeId = (keyframe.result as { keyframeId: string }).keyframeId;
    const updated = executeAgentTool("update_animation_keyframe", {
      target: "module",
      moduleId: id,
      property: "opacity",
      keyframeId,
      time: 1500,
      value: 0.25,
      easing: "linear",
    });
    expect(updated.ok).toBe(true);
    const timing = executeAgentTool("set_animation_timing", {
      target: "module",
      moduleId: id,
      duration: 5000,
      loop: false,
    });
    expect(timing.ok).toBe(true);

    const page = useEditorStore.getState().project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);
    expect(module?.animations?.entrance).toBe("fade-in");
    expect(module?.keyframes?.duration).toBe(5000);
    expect(module?.keyframes?.loop).toBe(false);
    expect(module?.keyframes?.tracks.opacity).toHaveLength(2);
    expect(
      module?.keyframes?.tracks.opacity.find((item) => item.id === keyframeId),
    ).toMatchObject({ time: 1500, value: 0.25, easing: "linear" });

    const removedKeyframe = executeAgentTool("remove_animation_keyframe", {
      target: "module",
      moduleId: id,
      property: "opacity",
      keyframeId,
    });
    expect(removedKeyframe.ok).toBe(true);
    expect(
      useEditorStore
        .getState()
        .project.pages[0].modules.find((candidate) => candidate.id === id)
        ?.keyframes?.tracks.opacity,
    ).toHaveLength(1);

    const removedTrack = executeAgentTool("remove_animation_track", {
      target: "module",
      moduleId: id,
      property: "opacity",
    });
    expect(removedTrack.ok).toBe(true);
    expect(
      useEditorStore
        .getState()
        .project.pages[0].modules.find((candidate) => candidate.id === id)
        ?.keyframes?.tracks.opacity,
    ).toBeUndefined();

    const invalid = executeAgentTool("set_preset_animation", {
      target: "module",
      moduleId: id,
      entrance: "unknown-animation",
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toContain("entrance");
  });

  it("attaches wand-selected script blocks and updates them", async () => {
    const page = useEditorStore.getState().project.pages[0];
    page.scriptBoard = {
      blocks: [
        {
          id: "block_a",
          kind: "custom",
          title: "点击逻辑",
          code: 'console.log("old");',
          x: 0,
          y: 0,
          width: 260,
          height: 168,
        },
      ],
      connections: [],
    };
    const mocked = vi.mocked(chatCompletion);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: "正在修改积木。",
        tool_calls: [
          {
            id: "call_board",
            type: "function",
            function: {
              name: "update_script_blocks",
              arguments: JSON.stringify({
                blocks: [
                  { id: "block_a", code: 'console.log("new");' },
                ],
              }),
            },
          },
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: { role: "assistant", content: "积木已修改。" },
    } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "改成输出 new",
      selectedModuleIds: [],
      selectedScriptBlockIds: ["block_a"],
    });

    expect(result.traces[0]).toMatchObject({
      name: "update_script_blocks",
      status: "success",
    });
    const updated = useEditorStore
      .getState()
      .project.pages[0].scriptBoard?.blocks.find(
        (block) => block.id === "block_a",
      );
    expect(updated?.code).toBe('console.log("new");');
    const userMessage = mocked.mock.calls[0][1].find(
      (message) => message.role === "user",
    );
    expect(userMessage?.content).toContain("[魔杖选中的脚本积木]");
    expect(userMessage?.content).toContain('console.log("old");');
  });

  it("returns tool errors to the model instead of throwing", async () => {
    const mocked = vi.mocked(chatCompletion);
    mocked.mockResolvedValueOnce({
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_bad",
            type: "function",
            function: {
              name: "update_module",
              arguments: JSON.stringify({ id: "missing", patch: {} }),
            },
          },
        ],
      },
    } as never);
    mocked.mockResolvedValueOnce({
      message: { role: "assistant", content: "模块不存在。" },
    } as never);

    const result = await runAgentTurn({
      config,
      skillId: "general",
      history: [],
      userText: "修改一个不存在的模块",
      selectedModuleIds: [],
    });
    expect(result.content).toBe("模块不存在。");
    expect(result.traces[0].status).toBe("error");
  });
});
