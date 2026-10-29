import { nanoid } from "nanoid";
import type { ModuleNode, Page, Project, Theme } from "./types";
import { DEFAULT_FONT_FAMILY } from "./fonts";

export const DEFAULT_THEME: Theme = {
  fontFamily: DEFAULT_FONT_FAMILY,
  primary: "#6750a4",
  text: "#1d1b20",
  muted: "#49454f",
  surface: "#ffffff",
};

export const DEFAULT_PAGE_WIDTH = 1200;
export const DEFAULT_PAGE_HEIGHT = 1200;
export const DEFAULT_GRID = 16;

export function createId(prefix = "m"): string {
  return `${prefix}_${nanoid(10)}`;
}

export function createEmptyPage(
  title = "未命名页面",
  width = DEFAULT_PAGE_WIDTH,
  height = DEFAULT_PAGE_HEIGHT,
  grid = DEFAULT_GRID,
): Page {
  return {
    id: createId("page"),
    title,
    width,
    height,
    grid,
    background: "#ffffff",
    modules: [],
  };
}

function welcomeModules(): ModuleNode[] {
  return [
    {
      id: "m_welcome_box",
      type: "core.box",
      x: 656,
      y: 80,
      width: 480,
      height: 336,
      props: {
        background: "#f3edf7",
        radius: 24,
        borderColor: "#eaddff",
        borderWidth: 1,
      },
    },
    {
      id: "m_welcome_heading",
      type: "core.heading",
      x: 64,
      y: 80,
      width: 528,
      height: 128,
      props: {
        text: "用 AI 构建网页",
        level: 1,
        align: "left",
        fontSize: 56,
        fontWeight: 700,
        lineHeight: 1.12,
        letterSpacing: -1,
        color: "#1d1b20",
      },
    },
    {
      id: "m_welcome_text",
      type: "core.text",
      x: 64,
      y: 224,
      width: 528,
      height: 96,
      props: {
        text: "从左侧拖入模块，所有元素自动对齐点阵网格。\n让 Agent 通过工具直接修改页面。",
        align: "left",
        size: "lg",
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1.7,
        letterSpacing: 0,
        color: "#49454f",
      },
    },
    {
      id: "m_welcome_button",
      type: "core.button",
      x: 64,
      y: 352,
      width: 192,
      height: 48,
      props: {
        text: "开始设计",
        variant: "primary",
        href: "",
        fontWeight: 600,
        letterSpacing: 0,
        radius: 10,
      },
    },
    {
      id: "m_welcome_input",
      type: "core.input",
      x: 736,
      y: 160,
      width: 320,
      height: 64,
      props: {
        label: "邮箱地址",
        placeholder: "you@example.com",
        inputType: "email",
        fontWeight: 400,
        labelFontSize: 12,
        labelFontWeight: 600,
        radius: 8,
      },
    },
    {
      id: "m_welcome_divider",
      type: "core.divider",
      x: 736,
      y: 272,
      width: 320,
      height: 16,
      props: {
        color: "#cac4d0",
        thickness: 1,
      },
    },
  ];
}

export function defaultProject(): Project {
  return {
    version: 1,
    name: "未命名项目",
    description: "",
    type: "html",
    template: "static",
    theme: { ...DEFAULT_THEME },
    pages: [
      {
        ...createEmptyPage("首页"),
        modules: welcomeModules(),
      },
    ],
  };
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
