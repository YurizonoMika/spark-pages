import type { CSSProperties } from "react";
import {
  Heading1,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Square,
  TextCursorInput,
  Type,
} from "lucide-react";
import { escapeHtml, htmlAttr } from "../../lib/escape";
import type { ModuleNode } from "../../model/types";
import { MODULE_FONT_OPTIONS } from "../../model/fonts";
import {
  propNumber,
  propString,
  type ModuleDefinition,
  type ModuleRenderContext,
} from "../types";
import { registerModules } from "../registry";

const headingSizes: Record<number, number> = { 1: 56, 2: 40, 3: 30 };
const textSizes: Record<string, number> = { sm: 14, md: 16, lg: 20 };

function textAlign(value: string): CSSProperties["textAlign"] {
  if (value === "center" || value === "right") {
    return value;
  }
  return "left";
}

function objectFit(value: string): CSSProperties["objectFit"] {
  if (value === "contain" || value === "fill" || value === "none") {
    return value;
  }
  return "cover";
}

function buttonColors(
  variant: string,
  theme: ModuleRenderContext["theme"],
  module: ModuleNode,
): CSSProperties {
  let colors: CSSProperties;
  if (variant === "secondary") {
    colors = {
      background: "#ffffff",
      color: theme.text,
      border: `1px solid ${theme.muted}55`,
    };
  } else if (variant === "ghost") {
    colors = {
      background: "transparent",
      color: theme.text,
      border: "1px solid transparent",
    };
  } else {
    colors = {
      background: theme.primary,
      color: "#ffffff",
      border: "1px solid transparent",
    };
  }

  const background = propString(module, "background");
  const textColor = propString(module, "textColor");
  const borderColor = propString(module, "borderColor");
  if (background) {
    colors.background = background;
  }
  if (textColor) {
    colors.color = textColor;
  }
  if (borderColor) {
    colors.border = `1px solid ${borderColor}`;
  }
  return colors;
}

function htmlButtonColors(
  variant: string,
  theme: ModuleRenderContext["theme"],
  module: ModuleNode,
): string {
  const colors = buttonColors(variant, theme, module);
  return Object.entries(colors)
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${cssKey}:${value}`;
    })
    .join(";");
}

const heading: ModuleDefinition = {
  type: "core.heading",
  label: "标题",
  category: "文本",
  description: "页面主标题或分节标题",
  icon: Heading1,
  defaultSize: { width: 480, height: 128 },
  minSize: { width: 96, height: 48 },
  defaultProps: {
    text: "标题",
    level: 1,
    align: "left",
    fontFamily: "",
    fontSize: 56,
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: -1,
    color: "",
  },
  fields: [
    {
      key: "text",
      label: "文本",
      kind: "textarea",
      rows: 3,
      placeholder: "输入标题",
    },
    {
      key: "level",
      label: "级别",
      kind: "select",
      options: [
        { label: "H1", value: 1 },
        { label: "H2", value: 2 },
        { label: "H3", value: 3 },
      ],
    },
    {
      key: "align",
      label: "对齐",
      kind: "select",
      options: [
        { label: "左对齐", value: "left" },
        { label: "居中", value: "center" },
        { label: "右对齐", value: "right" },
      ],
    },
    {
      key: "fontFamily",
      label: "字体",
      kind: "select",
      options: MODULE_FONT_OPTIONS,
    },
    {
      key: "fontSize",
      label: "字号",
      kind: "number",
      min: 8,
      max: 300,
      step: 1,
      placeholder: "按级别",
    },
    {
      key: "fontWeight",
      label: "字重",
      kind: "number",
      min: 100,
      max: 900,
      step: 100,
    },
    {
      key: "lineHeight",
      label: "行高",
      kind: "number",
      min: 0.7,
      max: 3,
      step: 0.05,
    },
    {
      key: "letterSpacing",
      label: "字间距 (px)",
      kind: "number",
      min: -20,
      max: 100,
      step: 0.5,
    },
    {
      key: "color",
      label: "颜色",
      kind: "color",
      placeholder: "留空跟随页面",
    },
  ],
  ai: {
    description:
      "标题模块，支持 H1-H3、字体、自由字号、字重、行高、字间距、对齐和颜色。",
    usage: "用于页面主标题或分节标题。",
  },
  render(module, { theme }) {
    const level = Math.round(propNumber(module, "level", 1));
    const size =
      propNumber(module, "fontSize", 0) || headingSizes[level] || headingSizes[1];
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          fontFamily,
          fontSize: size,
          lineHeight: propNumber(module, "lineHeight", 1.12),
          fontWeight: propNumber(module, "fontWeight", 700),
          letterSpacing: `${propNumber(module, "letterSpacing", -1)}px`,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          textAlign: textAlign(propString(module, "align", "left")),
          color: propString(module, "color") || theme.text,
        }}
      >
        {propString(module, "text")}
      </div>
    );
  },
  renderHtml(module, { theme }) {
    const level = Math.min(Math.max(Math.round(propNumber(module, "level", 1)), 1), 3);
    const size =
      propNumber(module, "fontSize", 0) || headingSizes[level] || headingSizes[1];
    const align = propString(module, "align", "left");
    const color = propString(module, "color") || theme.text;
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const fontWeight = propNumber(module, "fontWeight", 700);
    const lineHeight = propNumber(module, "lineHeight", 1.12);
    const letterSpacing = propNumber(module, "letterSpacing", -1);
    return `<h${level} style="margin:0;font-family:${htmlAttr(fontFamily)};font-size:${size}px;line-height:${lineHeight};font-weight:${fontWeight};letter-spacing:${letterSpacing}px;white-space:pre-wrap;text-align:${align};color:${htmlAttr(color)};">${escapeHtml(propString(module, "text"))}</h${level}>`;
  },
};

const text: ModuleDefinition = {
  type: "core.text",
  label: "文本",
  category: "文本",
  description: "段落说明文字",
  icon: Type,
  defaultSize: { width: 480, height: 96 },
  minSize: { width: 96, height: 32 },
  defaultProps: {
    text: "在这里输入一段文字。",
    size: "md",
    align: "left",
    fontFamily: "",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: 0,
    color: "",
  },
  fields: [
    {
      key: "text",
      label: "文本",
      kind: "textarea",
      rows: 5,
      placeholder: "输入正文",
    },
    {
      key: "align",
      label: "对齐",
      kind: "select",
      options: [
        { label: "左对齐", value: "left" },
        { label: "居中", value: "center" },
        { label: "右对齐", value: "right" },
      ],
    },
    {
      key: "fontFamily",
      label: "字体",
      kind: "select",
      options: MODULE_FONT_OPTIONS,
    },
    {
      key: "fontSize",
      label: "字号",
      kind: "number",
      min: 8,
      max: 200,
      step: 1,
      placeholder: "16",
    },
    {
      key: "fontWeight",
      label: "字重",
      kind: "number",
      min: 100,
      max: 900,
      step: 100,
    },
    {
      key: "lineHeight",
      label: "行高",
      kind: "number",
      min: 0.7,
      max: 3,
      step: 0.05,
    },
    {
      key: "letterSpacing",
      label: "字间距 (px)",
      kind: "number",
      min: -20,
      max: 100,
      step: 0.5,
    },
    {
      key: "color",
      label: "颜色",
      kind: "color",
      placeholder: "留空跟随页面",
    },
  ],
  ai: {
    description:
      "正文段落模块，支持字体、自由字号、字重、行高、字间距、对齐和颜色。",
    usage: "用于说明文字、副标题或正文内容。",
  },
  render(module, { theme }) {
    const size =
      propNumber(module, "fontSize", 0) ||
      textSizes[propString(module, "size", "md")] ||
      16;
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    return (
      <p
        style={{
          margin: 0,
          width: "100%",
          height: "100%",
          fontFamily,
          fontSize: size,
          lineHeight: propNumber(module, "lineHeight", 1.7),
          fontWeight: propNumber(module, "fontWeight", 400),
          letterSpacing: `${propNumber(module, "letterSpacing", 0)}px`,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          textAlign: textAlign(propString(module, "align", "left")),
          color: propString(module, "color") || theme.muted,
        }}
      >
        {propString(module, "text")}
      </p>
    );
  },
  renderHtml(module, { theme }) {
    const size =
      propNumber(module, "fontSize", 0) ||
      textSizes[propString(module, "size", "md")] ||
      16;
    const align = propString(module, "align", "left");
    const color = propString(module, "color") || theme.muted;
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const fontWeight = propNumber(module, "fontWeight", 400);
    const lineHeight = propNumber(module, "lineHeight", 1.7);
    const letterSpacing = propNumber(module, "letterSpacing", 0);
    return `<p style="margin:0;font-family:${htmlAttr(fontFamily)};font-size:${size}px;line-height:${lineHeight};font-weight:${fontWeight};letter-spacing:${letterSpacing}px;white-space:pre-wrap;text-align:${align};color:${htmlAttr(color)};">${escapeHtml(propString(module, "text"))}</p>`;
  },
};

const image: ModuleDefinition = {
  type: "core.image",
  label: "图片",
  category: "媒体",
  description: "本地或网络图片",
  icon: ImageIcon,
  defaultSize: { width: 480, height: 320 },
  minSize: { width: 64, height: 64 },
  defaultProps: {
    src: "",
    alt: "",
    fit: "cover",
    radius: 12,
  },
  fields: [
    {
      key: "src",
      label: "图片地址",
      kind: "text",
      placeholder: "https://… 或 assets/…",
    },
    { key: "alt", label: "替代文本", kind: "text", placeholder: "图片描述" },
    {
      key: "fit",
      label: "填充方式",
      kind: "select",
      options: [
        { label: "裁剪填充", value: "cover" },
        { label: "完整显示", value: "contain" },
        { label: "拉伸", value: "fill" },
      ],
    },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 200, step: 1 },
  ],
  ai: {
    description: "图片模块，支持填充方式和圆角。",
    usage: "用于配图、头像或背景图片。",
  },
  render(module) {
    const src = propString(module, "src");
    const radius = propNumber(module, "radius", 0);
    if (!src) {
      return (
        <div
          className="canvas-image-placeholder"
          style={{ borderRadius: radius }}
        >
          <ImageIcon size={28} strokeWidth={1.5} />
          <span>在右侧填写图片地址</span>
        </div>
      );
    }
    return (
      <img
        src={src}
        alt={propString(module, "alt")}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: objectFit(propString(module, "fit", "cover")),
          borderRadius: radius,
          display: "block",
        }}
      />
    );
  },
  renderHtml(module) {
    const src = propString(module, "src");
    const radius = propNumber(module, "radius", 0);
    const alt = propString(module, "alt");
    if (!src) {
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:${radius}px;color:#94a3b8;font-size:13px;">图片</div>`;
    }
    return `<img src="${htmlAttr(src)}" alt="${htmlAttr(alt)}" style="width:100%;height:100%;object-fit:${objectFit(propString(module, "fit", "cover"))};border-radius:${radius}px;display:block;" />`;
  },
};

const button: ModuleDefinition = {
  type: "core.button",
  label: "按钮",
  category: "交互",
  description: "行动按钮或链接",
  icon: MousePointerClick,
  defaultSize: { width: 192, height: 48 },
  minSize: { width: 64, height: 32 },
  defaultProps: {
    text: "按钮",
    variant: "primary",
    href: "",
    fontFamily: "",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 0,
    radius: 10,
    background: "",
    textColor: "",
    borderColor: "",
  },
  fields: [
    { key: "text", label: "文字", kind: "text", placeholder: "按钮文字" },
    {
      key: "variant",
      label: "样式",
      kind: "select",
      options: [
        { label: "主按钮", value: "primary" },
        { label: "次按钮", value: "secondary" },
        { label: "幽灵按钮", value: "ghost" },
      ],
    },
    { key: "href", label: "链接", kind: "text", placeholder: "# 或 https://…" },
    {
      key: "fontFamily",
      label: "字体",
      kind: "select",
      options: MODULE_FONT_OPTIONS,
    },
    {
      key: "fontSize",
      label: "字号",
      kind: "number",
      min: 8,
      max: 96,
      step: 1,
    },
    {
      key: "fontWeight",
      label: "字重",
      kind: "number",
      min: 100,
      max: 900,
      step: 100,
    },
    {
      key: "letterSpacing",
      label: "字间距 (px)",
      kind: "number",
      min: -10,
      max: 50,
      step: 0.5,
    },
    {
      key: "radius",
      label: "圆角",
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: "background",
      label: "背景色",
      kind: "color",
      placeholder: "留空跟随样式",
    },
    {
      key: "textColor",
      label: "文字色",
      kind: "color",
      placeholder: "留空跟随样式",
    },
    {
      key: "borderColor",
      label: "边框色",
      kind: "color",
      placeholder: "留空跟随样式",
    },
  ],
  ai: {
    description: "按钮模块，支持主按钮、次按钮、幽灵按钮、独立字体和颜色。",
    usage: "用于主要行动入口或链接。",
  },
  render(module, { theme }) {
    const colors = buttonColors(
      propString(module, "variant", "primary"),
      theme,
      module,
    );
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const fontSize = propNumber(module, "fontSize", 15);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: propNumber(module, "radius", 10),
          fontFamily,
          fontSize,
          fontWeight: propNumber(module, "fontWeight", 600),
          letterSpacing: `${propNumber(module, "letterSpacing", 0)}px`,
          ...colors,
        }}
      >
        {propString(module, "text")}
      </div>
    );
  },
  renderHtml(module, { theme }) {
    const colors = htmlButtonColors(
      propString(module, "variant", "primary"),
      theme,
      module,
    );
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const href = propString(module, "href");
    const tag = href ? "a" : "span";
    const hrefAttr = href ? ` href="${htmlAttr(href)}"` : "";
    const fontSize = propNumber(module, "fontSize", 15);
    const fontWeight = propNumber(module, "fontWeight", 600);
    const letterSpacing = propNumber(module, "letterSpacing", 0);
    const radius = propNumber(module, "radius", 10);
    return `<${tag}${hrefAttr} style="display:flex;width:100%;height:100%;box-sizing:border-box;align-items:center;justify-content:center;border-radius:${radius}px;font-family:${htmlAttr(fontFamily)};font-size:${fontSize}px;font-weight:${fontWeight};letter-spacing:${letterSpacing}px;text-decoration:none;${colors};">${escapeHtml(propString(module, "text"))}</${tag}>`;
  },
};

const divider: ModuleDefinition = {
  type: "core.divider",
  label: "分割线",
  category: "布局",
  description: "水平分隔内容",
  icon: Minus,
  defaultSize: { width: 480, height: 16 },
  minSize: { width: 32, height: 8 },
  defaultProps: {
    color: "#e2e8f0",
    thickness: 1,
  },
  fields: [
    { key: "color", label: "颜色", kind: "color" },
    {
      key: "thickness",
      label: "粗细",
      kind: "number",
      min: 1,
      max: 16,
      step: 1,
    },
  ],
  ai: {
    description: "水平分割线，支持颜色和粗细。",
    usage: "用于分隔内容区块。",
  },
  render(module) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: propNumber(module, "thickness", 1),
            background: propString(module, "color", "#e2e8f0"),
          }}
        />
      </div>
    );
  },
  renderHtml(module) {
    return `<div style="width:100%;height:100%;display:flex;align-items:center;"><div style="width:100%;height:${propNumber(module, "thickness", 1)}px;background:${htmlAttr(propString(module, "color", "#e2e8f0"))};"></div></div>`;
  },
};

const spacer: ModuleDefinition = {
  type: "core.spacer",
  label: "间距",
  category: "布局",
  description: "创建空白间距",
  icon: MoveVertical,
  defaultSize: { width: 480, height: 64 },
  minSize: { width: 16, height: 16 },
  defaultProps: {},
  fields: [],
  ai: {
    description: "空白间距模块。",
    usage: "用于撑开垂直空间。",
  },
  render(_module, { preview }) {
    if (preview) {
      return null;
    }
    return (
      <div className="canvas-spacer">
        <MoveVertical size={16} />
        <span>间距</span>
      </div>
    );
  },
  renderHtml() {
    return "";
  },
};

const box: ModuleDefinition = {
  type: "core.box",
  label: "背景块",
  category: "布局",
  description: "纯色或描边背景",
  icon: Square,
  defaultSize: { width: 480, height: 240 },
  minSize: { width: 32, height: 32 },
  defaultProps: {
    background: "#f8fafc",
    radius: 16,
    borderColor: "transparent",
    borderWidth: 1,
  },
  fields: [
    { key: "background", label: "背景色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color" },
    {
      key: "borderWidth",
      label: "边框宽度",
      kind: "number",
      min: 0,
      max: 32,
      step: 1,
    },
    {
      key: "radius",
      label: "圆角",
      kind: "number",
      min: 0,
      max: 200,
      step: 1,
    },
  ],
  ai: {
    description: "背景块，可作为区块底色或卡片背景。",
    usage: "放在其他模块下层，用于视觉分区。",
  },
  render(module) {
    const radius = propNumber(module, "radius", 0);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: propString(module, "background", "#f8fafc"),
          borderRadius: radius,
          border: `${propNumber(module, "borderWidth", 1)}px solid ${propString(module, "borderColor", "transparent")}`,
        }}
      />
    );
  },
  renderHtml(module) {
    const radius = propNumber(module, "radius", 0);
    return `<div style="width:100%;height:100%;background:${htmlAttr(propString(module, "background", "#f8fafc"))};border-radius:${radius}px;border:${propNumber(module, "borderWidth", 1)}px solid ${htmlAttr(propString(module, "borderColor", "transparent"))};"></div>`;
  },
};

const input: ModuleDefinition = {
  type: "core.input",
  label: "输入框",
  category: "交互",
  description: "带标签的表单输入",
  icon: TextCursorInput,
  defaultSize: { width: 320, height: 80 },
  minSize: { width: 96, height: 48 },
  defaultProps: {
    label: "标签",
    placeholder: "请输入",
    inputType: "text",
    fontFamily: "",
    fontSize: 14,
    fontWeight: 400,
    labelFontSize: 12,
    labelFontWeight: 600,
    radius: 8,
    labelColor: "",
    textColor: "",
    background: "",
    borderColor: "",
  },
  fields: [
    { key: "label", label: "标签", kind: "text", placeholder: "字段名称" },
    { key: "placeholder", label: "占位文字", kind: "text" },
    {
      key: "inputType",
      label: "类型",
      kind: "select",
      options: [
        { label: "文本", value: "text" },
        { label: "邮箱", value: "email" },
        { label: "密码", value: "password" },
        { label: "数字", value: "number" },
        { label: "电话", value: "tel" },
      ],
    },
    {
      key: "fontFamily",
      label: "字体",
      kind: "select",
      options: MODULE_FONT_OPTIONS,
    },
    {
      key: "fontSize",
      label: "字号",
      kind: "number",
      min: 8,
      max: 64,
      step: 1,
    },
    {
      key: "fontWeight",
      label: "字重",
      kind: "number",
      min: 100,
      max: 900,
      step: 100,
    },
    {
      key: "labelFontSize",
      label: "标签字号",
      kind: "number",
      min: 8,
      max: 32,
      step: 1,
    },
    {
      key: "labelFontWeight",
      label: "标签字重",
      kind: "number",
      min: 100,
      max: 900,
      step: 100,
    },
    {
      key: "radius",
      label: "圆角",
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: "labelColor",
      label: "标签色",
      kind: "color",
      placeholder: "留空跟随页面",
    },
    {
      key: "textColor",
      label: "文字色",
      kind: "color",
      placeholder: "留空跟随页面",
    },
    {
      key: "background",
      label: "背景色",
      kind: "color",
      placeholder: "留空使用默认",
    },
    {
      key: "borderColor",
      label: "边框色",
      kind: "color",
      placeholder: "留空使用默认",
    },
  ],
  ai: {
    description:
      "表单输入框，支持文本、邮箱、密码、数字、电话类型、独立字体和颜色。",
    usage: "用于收集用户输入。",
  },
  render(module, { theme }) {
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const fontSize = propNumber(module, "fontSize", 14);
    const fontWeight = propNumber(module, "fontWeight", 400);
    const labelFontSize = propNumber(module, "labelFontSize", 12);
    const labelFontWeight = propNumber(module, "labelFontWeight", 600);
    const radius = propNumber(module, "radius", 8);
    const textColor = propString(module, "textColor") || theme.text;
    const labelColor = propString(module, "labelColor") || theme.muted;
    const background = propString(module, "background") || "#f7f2fa";
    const borderColor = propString(module, "borderColor") || "#cac4d0";
    return (
      <label
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 6,
          fontFamily,
          color: textColor,
        }}
      >
        <span
          style={{
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            color: labelColor,
          }}
        >
          {propString(module, "label")}
        </span>
        <input
          readOnly
          tabIndex={-1}
          type={propString(module, "inputType", "text")}
          placeholder={propString(module, "placeholder")}
          style={{
            width: "100%",
            height: 40,
            boxSizing: "border-box",
            padding: "0 12px",
            borderRadius: radius,
            border: `1px solid ${borderColor}`,
            background,
            color: textColor,
            fontSize,
            fontWeight,
            outline: "none",
            pointerEvents: "none",
          }}
        />
      </label>
    );
  },
  renderHtml(module, { theme }) {
    const type = propString(module, "inputType", "text");
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const fontSize = propNumber(module, "fontSize", 14);
    const fontWeight = propNumber(module, "fontWeight", 400);
    const labelFontSize = propNumber(module, "labelFontSize", 12);
    const labelFontWeight = propNumber(module, "labelFontWeight", 600);
    const radius = propNumber(module, "radius", 8);
    const textColor = propString(module, "textColor") || theme.text;
    const labelColor = propString(module, "labelColor") || theme.muted;
    const background = propString(module, "background") || "#f7f2fa";
    const borderColor = propString(module, "borderColor") || "#cac4d0";
    return `<label style="display:flex;width:100%;height:100%;box-sizing:border-box;flex-direction:column;justify-content:center;gap:6px;font-family:${htmlAttr(fontFamily)};color:${htmlAttr(textColor)};"><span style="font-size:${labelFontSize}px;font-weight:${labelFontWeight};color:${htmlAttr(labelColor)};">${escapeHtml(propString(module, "label"))}</span><input type="${htmlAttr(type)}" placeholder="${htmlAttr(propString(module, "placeholder"))}" style="width:100%;height:40px;box-sizing:border-box;padding:0 12px;border-radius:${radius}px;border:1px solid ${htmlAttr(borderColor)};background:${htmlAttr(background)};color:${htmlAttr(textColor)};font-size:${fontSize}px;font-weight:${fontWeight};outline:none;" /></label>`;
  },
};

registerModules([
  heading,
  text,
  image,
  button,
  divider,
  spacer,
  box,
  input,
]);

export {
  heading,
  text,
  image,
  button,
  divider,
  spacer,
  box,
  input,
};
