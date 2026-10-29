import type { FieldOption } from "../modules/types";

export const FONT_OPTIONS: FieldOption[] = [
  {
    label: "系统默认",
    value:
      '"SF Pro Text", "Roboto", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  {
    label: "苹方 / 思源黑体",
    value:
      '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
  },
  {
    label: "宋体",
    value: '"Songti SC", "Noto Serif CJK SC", "SimSun", serif',
  },
  {
    label: "楷体",
    value: '"Kaiti SC", "KaiTi", "STKaiti", serif',
  },
  {
    label: "Helvetica Neue",
    value: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    label: "Arial",
    value: 'Arial, "Helvetica Neue", sans-serif',
  },
  {
    label: "Avenir Next",
    value: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif',
  },
  {
    label: "Georgia",
    value: 'Georgia, "Times New Roman", serif',
  },
  {
    label: "Menlo / 等宽",
    value: 'Menlo, "SF Mono", Monaco, monospace',
  },
];

export const DEFAULT_FONT_FAMILY = String(FONT_OPTIONS[0].value);

export const MODULE_FONT_OPTIONS: FieldOption[] = [
  { label: "跟随页面", value: "" },
  ...FONT_OPTIONS,
];
