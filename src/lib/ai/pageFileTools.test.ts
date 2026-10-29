import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));

import { invoke } from "@tauri-apps/api/core";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { pageCodeDirectory, pageSlug } from "./projectContext";
import { executePageFileTool } from "./pageFileTools";

const folder = "/tmp/spark-agent-page";
const project = () => useEditorStore.getState().project;
const page = () => selectActivePage(useEditorStore.getState());
const directory = () => pageCodeDirectory(project(), pageSlug(project(), page()));

describe("agent page file tools", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useEditorStore.getState().newProject();
    useEditorStore.getState().setProjectFolder(folder);
  });

  it("lists only files in the active page directory", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { path: `${directory()}/index.html`, size: 10, isDir: false },
      { path: `${directory()}/script.js`, size: 20, isDir: false },
      { path: "pages/other/index.html", size: 30, isDir: false },
      { path: directory(), size: 0, isDir: true },
    ]);
    const result = await executePageFileTool("list_page_files", {});
    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      directory: directory(),
      files: [
        { path: `${directory()}/index.html`, size: 10 },
        { path: `${directory()}/script.js`, size: 20 },
      ],
    });
  });

  it("reads a page file and rejects paths outside the page", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("<h1>Hello</h1>");
    const result = await executePageFileTool("read_page_file", {
      path: `${directory()}/index.html`,
    });
    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      path: `${directory()}/index.html`,
      content: "<h1>Hello</h1>",
    });
    expect(invoke).toHaveBeenCalledWith("read_text_file", {
      path: `${folder}/${directory()}/index.html`,
    });

    const rejected = await executePageFileTool("read_page_file", {
      path: "pages/other/index.html",
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain("当前页面目录");
  });

  it("writes page files directly to the project folder", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(folder);
    const result = await executePageFileTool("write_page_file", {
      path: `${directory()}/script.ts`,
      content: "const value: number = 1;",
    });
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith("write_build_files", {
      root: folder,
      files: [
        {
          path: `${directory()}/script.ts`,
          content: "const value: number = 1;",
        },
      ],
    });
    expect(
      useEditorStore.getState().filesVersion,
    ).toBeGreaterThan(0);
  });

  it("rejects unsafe and unsupported page files", async () => {
    const outside = await executePageFileTool("write_page_file", {
      path: "pages/other/index.html",
      content: "nope",
    });
    expect(outside.ok).toBe(false);

    const designFile = await executePageFileTool("write_page_file", {
      path: `${directory()}/page.spark`,
      content: "nope",
    });
    expect(designFile.ok).toBe(false);
    expect(designFile.error).toContain("不支持");
  });
});
