import type { CSSProperties } from "react";
import {
  AlignLeft,
  CircleCheck,
  CreditCard,
  Gauge,
  Link as LinkIcon,
  List as ListIcon,
  ListFilter,
  Play,
  Quote as QuoteIcon,
  Tag,
  UserRound,
} from "lucide-react";
import { escapeHtml, htmlAttr } from "../../lib/escape";
import { MODULE_FONT_OPTIONS } from "../../model/fonts";
import {
  propBoolean,
  propNumber,
  propString,
  type ModuleDefinition,
  type ModuleField,
} from "../types";

function textAlign(value: string): CSSProperties["textAlign"] {
  if (value === "center" || value === "right") {
    return value;
  }
  return "left";
}

function fit(value: string): CSSProperties["objectFit"] {
  if (value === "contain" || value === "fill" || value === "none") {
    return value;
  }
  return "cover";
}

function shapeRadius(shape: string): string {
  if (shape === "circle") {
    return "50%";
  }
  if (shape === "rounded") {
    return "22%";
  }
  return "0";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fontFields(): ModuleField[] {
  return [
    {
      key: "fontFamily",
      label: "字体",
      kind: "select",
      options: MODULE_FONT_OPTIONS,
    },
    { key: "fontSize", label: "字号", kind: "number", min: 8, max: 96, step: 1 },
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
      min: 0.8,
      max: 3,
      step: 0.05,
    },
  ];
}

export const card: ModuleDefinition = {
  type: "core.card",
  label: "卡片",
  category: "布局",
  description: "带标题和说明的内容卡片",
  icon: CreditCard,
  defaultSize: { width: 360, height: 220 },
  minSize: { width: 120, height: 96 },
  defaultProps: {
    eyebrow: "推荐",
    title: "卡片标题",
    description: "在这里写一段简短的卡片说明，介绍这个功能或内容。",
    background: "#ffffff",
    borderColor: "#e2e8f0",
    titleColor: "",
    textColor: "",
    radius: 16,
    padding: 24,
    shadow: true,
    align: "left",
    titleSize: 22,
    fontSize: 14,
  },
  fields: [
    { key: "eyebrow", label: "眉题", kind: "text", placeholder: "可选" },
    { key: "title", label: "标题", kind: "text" },
    { key: "description", label: "说明", kind: "textarea", rows: 3 },
    {
      key: "align",
      label: "对齐",
      kind: "select",
      options: [
        { label: "左对齐", value: "left" },
        { label: "居中", value: "center" },
      ],
    },
    { key: "background", label: "背景色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color" },
    { key: "titleColor", label: "标题色", kind: "color" },
    { key: "textColor", label: "说明色", kind: "color" },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 120, step: 1 },
    { key: "padding", label: "内边距", kind: "number", min: 0, max: 120, step: 1 },
    { key: "shadow", label: "阴影", kind: "boolean" },
    { key: "titleSize", label: "标题字号", kind: "number", min: 10, max: 72, step: 1 },
    { key: "fontSize", label: "说明字号", kind: "number", min: 8, max: 40, step: 1 },
  ],
  ai: {
    description: "内容卡片，包含眉题、标题和说明，支持背景、描边、圆角和阴影。",
    usage: "用于功能卡片、价格卡、信息卡等。",
  },
  render(module, { theme }) {
    const background = propString(module, "background", "#ffffff");
    const borderColor = propString(module, "borderColor", "#e2e8f0");
    const radius = propNumber(module, "radius", 16);
    const padding = propNumber(module, "padding", 24);
    const align = propString(module, "align", "left");
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
          textAlign: textAlign(align),
          background,
          border: `1px solid ${borderColor}`,
          borderRadius: radius,
          boxShadow: propBoolean(module, "shadow", false)
            ? "0 10px 30px rgba(15, 23, 42, 0.10)"
            : "none",
          fontFamily: theme.fontFamily,
          color: propString(module, "textColor") || theme.muted,
          overflow: "hidden",
        }}
      >
        {propString(module, "eyebrow") ? (
          <span
            style={{
              color: theme.primary,
              fontSize: 10,
              fontWeight: 650,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {propString(module, "eyebrow")}
          </span>
        ) : null}
        <strong
          style={{
            color: propString(module, "titleColor") || theme.text,
            fontSize: propNumber(module, "titleSize", 22),
            lineHeight: 1.25,
          }}
        >
          {propString(module, "title")}
        </strong>
        <p
          style={{
            margin: 0,
            fontSize: propNumber(module, "fontSize", 14),
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {propString(module, "description")}
        </p>
      </div>
    );
  },
  renderHtml(module, { theme }) {
    const background = propString(module, "background", "#ffffff");
    const borderColor = propString(module, "borderColor", "#e2e8f0");
    const radius = propNumber(module, "radius", 16);
    const padding = propNumber(module, "padding", 24);
    const align = propString(module, "align", "left");
    const shadow = propBoolean(module, "shadow", false)
      ? "0 10px 30px rgba(15, 23, 42, 0.10)"
      : "none";
    return `<div style="width:100%;height:100%;box-sizing:border-box;padding:${padding}px;display:flex;flex-direction:column;justify-content:center;gap:8px;text-align:${align};background:${htmlAttr(background)};border:1px solid ${htmlAttr(borderColor)};border-radius:${radius}px;box-shadow:${shadow};font-family:${htmlAttr(theme.fontFamily)};color:${htmlAttr(propString(module, "textColor") || theme.muted)};overflow:hidden;">${propString(module, "eyebrow") ? `<span style="color:${htmlAttr(theme.primary)};font-size:10px;font-weight:650;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(propString(module, "eyebrow"))}</span>` : ""}<strong style="color:${htmlAttr(propString(module, "titleColor") || theme.text)};font-size:${propNumber(module, "titleSize", 22)}px;line-height:1.25;">${escapeHtml(propString(module, "title"))}</strong><p style="margin:0;font-size:${propNumber(module, "fontSize", 14)}px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(propString(module, "description"))}</p></div>`;
  },
};

export const link: ModuleDefinition = {
  type: "core.link",
  label: "链接",
  category: "文本",
  description: "可点击的文字链接",
  icon: LinkIcon,
  defaultSize: { width: 220, height: 32 },
  minSize: { width: 48, height: 20 },
  defaultProps: {
    text: "了解更多",
    href: "#",
    color: "",
    fontFamily: "",
    fontSize: 14,
    fontWeight: 500,
    underline: true,
    align: "left",
  },
  fields: [
    { key: "text", label: "文字", kind: "text" },
    { key: "href", label: "链接", kind: "text", placeholder: "# 或 https://…" },
    { key: "align", label: "对齐", kind: "select", options: [
      { label: "左对齐", value: "left" },
      { label: "居中", value: "center" },
      { label: "右对齐", value: "right" },
    ] },
    { key: "underline", label: "下划线", kind: "boolean" },
    { key: "color", label: "颜色", kind: "color", placeholder: "留空跟随主题" },
    ...fontFields(),
  ],
  ai: {
    description: "文字链接，支持自定义链接地址、颜色、字号和下划线。",
    usage: "用于跳转、了解更多、导航文字等。",
  },
  render(module, { theme }) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent:
            propString(module, "align", "left") === "center"
              ? "center"
              : propString(module, "align", "left") === "right"
                ? "flex-end"
                : "flex-start",
          color: propString(module, "color") || theme.primary,
          fontFamily: propString(module, "fontFamily") || theme.fontFamily,
          fontSize: propNumber(module, "fontSize", 14),
          fontWeight: propNumber(module, "fontWeight", 500),
          textDecoration: propBoolean(module, "underline", false)
            ? "underline"
            : "none",
        }}
      >
        {propString(module, "text")}
      </div>
    );
  },
  renderHtml(module, { theme }) {
    return `<a href="${htmlAttr(propString(module, "href", "#"))}" style="display:flex;width:100%;height:100%;align-items:center;justify-content:${propString(module, "align", "left") === "center" ? "center" : propString(module, "align", "left") === "right" ? "flex-end" : "flex-start"};color:${htmlAttr(propString(module, "color") || theme.primary)};font-family:${htmlAttr(propString(module, "fontFamily") || theme.fontFamily)};font-size:${propNumber(module, "fontSize", 14)}px;font-weight:${propNumber(module, "fontWeight", 500)};text-decoration:${propBoolean(module, "underline", false) ? "underline" : "none"};">${escapeHtml(propString(module, "text"))}</a>`;
  },
};

export const badge: ModuleDefinition = {
  type: "core.badge",
  label: "徽章",
  category: "文本",
  description: "状态标签或小徽章",
  icon: Tag,
  defaultSize: { width: 120, height: 32 },
  minSize: { width: 32, height: 20 },
  defaultProps: {
    text: "NEW",
    background: "#e8def8",
    color: "#1d192b",
    borderColor: "",
    radius: 999,
    fontSize: 11,
    fontWeight: 650,
    paddingX: 10,
    paddingY: 4,
  },
  fields: [
    { key: "text", label: "文字", kind: "text" },
    { key: "background", label: "背景色", kind: "color" },
    { key: "color", label: "文字色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color", placeholder: "可选" },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 999, step: 1 },
    { key: "fontSize", label: "字号", kind: "number", min: 7, max: 32, step: 1 },
    { key: "fontWeight", label: "字重", kind: "number", min: 100, max: 900, step: 100 },
    { key: "paddingX", label: "左右内边距", kind: "number", min: 0, max: 48, step: 1 },
    { key: "paddingY", label: "上下内边距", kind: "number", min: 0, max: 24, step: 1 },
  ],
  ai: {
    description: "小徽章 / 标签，适合状态、分类或 NEW 标记。",
    usage: "放在卡片或标题旁，突出状态与分类。",
  },
  render(module) {
    const radius = propNumber(module, "radius", 999);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: `${propNumber(module, "paddingY", 4)}px ${propNumber(module, "paddingX", 10)}px`,
            borderRadius: radius,
            background: propString(module, "background", "#e8def8"),
            color: propString(module, "color", "#1d192b"),
            border: propString(module, "borderColor")
              ? `1px solid ${propString(module, "borderColor")}`
              : "1px solid transparent",
            fontSize: propNumber(module, "fontSize", 11),
            fontWeight: propNumber(module, "fontWeight", 650),
            whiteSpace: "nowrap",
          }}
        >
          {propString(module, "text")}
        </span>
      </div>
    );
  },
  renderHtml(module) {
    const radius = propNumber(module, "radius", 999);
    const border = propString(module, "borderColor")
      ? `1px solid ${htmlAttr(propString(module, "borderColor"))}`
      : "1px solid transparent";
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span style="display:inline-flex;align-items:center;padding:${propNumber(module, "paddingY", 4)}px ${propNumber(module, "paddingX", 10)}px;border-radius:${radius}px;background:${htmlAttr(propString(module, "background", "#e8def8"))};color:${htmlAttr(propString(module, "color", "#1d192b"))};border:${border};font-size:${propNumber(module, "fontSize", 11)}px;font-weight:${propNumber(module, "fontWeight", 650)};white-space:nowrap;">${escapeHtml(propString(module, "text"))}</span></div>`;
  },
};

export const avatar: ModuleDefinition = {
  type: "core.avatar",
  label: "头像",
  category: "媒体",
  description: "圆形或圆角头像",
  icon: UserRound,
  defaultSize: { width: 96, height: 96 },
  minSize: { width: 32, height: 32 },
  defaultProps: {
    src: "",
    alt: "",
    shape: "circle",
    fit: "cover",
    fallback: "头像",
    background: "#e8def8",
    color: "#1d192b",
    borderColor: "#ffffff",
    borderWidth: 2,
  },
  fields: [
    { key: "src", label: "头像图片", kind: "text", placeholder: "选择文件或填写地址" },
    { key: "alt", label: "替代文本", kind: "text" },
    { key: "fallback", label: "占位文字", kind: "text" },
    { key: "shape", label: "形状", kind: "select", options: [
      { label: "圆形", value: "circle" },
      { label: "圆角", value: "rounded" },
      { label: "方形", value: "square" },
    ] },
    { key: "fit", label: "填充方式", kind: "select", options: [
      { label: "裁剪填充", value: "cover" },
      { label: "完整显示", value: "contain" },
    ] },
    { key: "background", label: "背景色", kind: "color" },
    { key: "color", label: "占位文字色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color" },
    { key: "borderWidth", label: "边框宽度", kind: "number", min: 0, max: 16, step: 1 },
  ],
  ai: {
    description: "头像模块，支持圆形、圆角、方形、图片和文字占位。",
    usage: "用于用户头像、团队介绍、评价头像。",
  },
  render(module) {
    const radius = shapeRadius(propString(module, "shape", "circle"));
    const src = propString(module, "src");
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", border: `${propNumber(module, "borderWidth", 0)}px solid ${propString(module, "borderColor", "transparent")}`, background: propString(module, "background", "#e8def8"), display: "flex", alignItems: "center", justifyContent: "center" }}>
        {src ? (
          <img src={src} alt={propString(module, "alt")} draggable={false} style={{ width: "100%", height: "100%", objectFit: fit(propString(module, "fit", "cover")), display: "block" }} />
        ) : (
          <span style={{ color: propString(module, "color", "#1d192b"), fontSize: 11, fontWeight: 600 }}>
            {propString(module, "fallback", "头像").slice(0, 8)}
          </span>
        )}
      </div>
    );
  },
  renderHtml(module) {
    const radius = shapeRadius(propString(module, "shape", "circle"));
    const src = propString(module, "src");
    const border = `${propNumber(module, "borderWidth", 0)}px solid ${htmlAttr(propString(module, "borderColor", "transparent"))}`;
    return `<div style="width:100%;height:100%;border-radius:${radius};overflow:hidden;border:${border};background:${htmlAttr(propString(module, "background", "#e8def8"))};display:flex;align-items:center;justify-content:center;">${src ? `<img src="${htmlAttr(src)}" alt="${htmlAttr(propString(module, "alt"))}" style="width:100%;height:100%;object-fit:${htmlAttr(propString(module, "fit", "cover"))};display:block;" />` : `<span style="color:${htmlAttr(propString(module, "color", "#1d192b"))};font-size:11px;font-weight:600;">${escapeHtml(propString(module, "fallback", "头像").slice(0, 8))}</span>`}</div>`;
  },
};

export const video: ModuleDefinition = {
  type: "core.video",
  label: "视频",
  category: "媒体",
  description: "HTML5 视频播放器",
  icon: Play,
  defaultSize: { width: 520, height: 300 },
  minSize: { width: 160, height: 90 },
  defaultProps: {
    src: "",
    poster: "",
    controls: true,
    autoplay: false,
    muted: true,
    loop: false,
    fit: "cover",
    radius: 12,
    background: "#0f172a",
  },
  fields: [
    { key: "src", label: "视频地址", kind: "text", placeholder: "https://…/video.mp4" },
    { key: "poster", label: "封面图", kind: "text", placeholder: "https://…/poster.jpg" },
    { key: "controls", label: "显示控制条", kind: "boolean" },
    { key: "autoplay", label: "自动播放", kind: "boolean" },
    { key: "muted", label: "静音", kind: "boolean" },
    { key: "loop", label: "循环播放", kind: "boolean" },
    { key: "fit", label: "填充方式", kind: "select", options: [
      { label: "裁剪填充", value: "cover" },
      { label: "完整显示", value: "contain" },
    ] },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 100, step: 1 },
    { key: "background", label: "背景色", kind: "color" },
  ],
  ai: {
    description: "HTML5 视频模块，支持封面、控制条、自动播放、静音、循环和圆角。",
    usage: "用于产品演示、背景视频或媒体内容。",
  },
  render(module) {
    const src = propString(module, "src");
    const radius = propNumber(module, "radius", 12);
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", background: propString(module, "background", "#0f172a"), display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {src ? (
          <video src={src} poster={propString(module, "poster") || undefined} muted={propBoolean(module, "muted", true)} loop={propBoolean(module, "loop", false)} playsInline style={{ width: "100%", height: "100%", objectFit: fit(propString(module, "fit", "cover")) }} />
        ) : (
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>填写视频地址</span>
        )}
        <span style={{ position: "absolute", width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d192b" }}>
          <Play size={18} />
        </span>
      </div>
    );
  },
  renderHtml(module) {
    const radius = propNumber(module, "radius", 12);
    if (!propString(module, "src")) {
      return `<div style="width:100%;height:100%;border-radius:${radius}px;background:${htmlAttr(propString(module, "background", "#0f172a"))};display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);font-size:12px;">视频</div>`;
    }
    return `<div style="width:100%;height:100%;border-radius:${radius}px;overflow:hidden;background:${htmlAttr(propString(module, "background", "#0f172a"))};"><video src="${htmlAttr(propString(module, "src"))}"${propString(module, "poster") ? ` poster="${htmlAttr(propString(module, "poster"))}"` : ""}${propBoolean(module, "controls", false) ? " controls" : ""}${propBoolean(module, "autoplay", false) ? " autoplay" : ""}${propBoolean(module, "muted", false) ? " muted" : ""}${propBoolean(module, "loop", false) ? " loop" : ""} playsinline style="width:100%;height:100%;object-fit:${htmlAttr(propString(module, "fit", "cover"))};"></video></div>`;
  },
};

export const list: ModuleDefinition = {
  type: "core.list",
  label: "列表",
  category: "文本",
  description: "项目符号或编号列表",
  icon: ListIcon,
  defaultSize: { width: 420, height: 132 },
  minSize: { width: 120, height: 48 },
  defaultProps: {
    items: "第一项内容\n第二项内容\n第三项内容",
    ordered: false,
    fontFamily: "",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.8,
    color: "",
    gap: 0,
  },
  fields: [
    { key: "items", label: "列表项", kind: "textarea", rows: 4, placeholder: "每行一个列表项" },
    { key: "ordered", label: "有序列表", kind: "boolean" },
    ...fontFields(),
    { key: "color", label: "文字色", kind: "color" },
    { key: "gap", label: "项间距", kind: "number", min: 0, max: 40, step: 1 },
  ],
  ai: {
    description: "列表模块，支持有序/无序列表、每行一项、字体和间距。",
    usage: "用于功能清单、步骤说明、要点列表。",
  },
  render(module, { theme }) {
    const items = propString(module, "items").split(/\r?\n/).filter((item) => item.trim());
    const style = {
      margin: 0,
      paddingLeft: 22,
      fontFamily: propString(module, "fontFamily") || theme.fontFamily,
      fontSize: propNumber(module, "fontSize", 14),
      fontWeight: propNumber(module, "fontWeight", 400),
      lineHeight: propNumber(module, "lineHeight", 1.8),
      color: propString(module, "color") || theme.text,
    };
    const itemStyle = { marginBottom: propNumber(module, "gap", 0) };
    return propBoolean(module, "ordered", false) ? (
      <ol style={style}>{items.map((item, index) => <li key={index} style={itemStyle}>{item}</li>)}</ol>
    ) : (
      <ul style={style}>{items.map((item, index) => <li key={index} style={itemStyle}>{item}</li>)}</ul>
    );
  },
  renderHtml(module, { theme }) {
    const items = propString(module, "items").split(/\r?\n/).filter((item) => item.trim());
    const tag = propBoolean(module, "ordered", false) ? "ol" : "ul";
    const listStyle = "margin:0;padding-left:22px;font-family:" + htmlAttr(propString(module, "fontFamily") || theme.fontFamily) + ";font-size:" + propNumber(module, "fontSize", 14) + "px;font-weight:" + propNumber(module, "fontWeight", 400) + ";line-height:" + propNumber(module, "lineHeight", 1.8) + ";color:" + htmlAttr(propString(module, "color") || theme.text) + ";";
    return `<${tag} style="${listStyle}">${items.map((item) => `<li style="margin-bottom:${propNumber(module, "gap", 0)}px;">${escapeHtml(item)}</li>`).join("")}</${tag}>`;
  },
};

export const quote: ModuleDefinition = {
  type: "core.quote",
  label: "引用",
  category: "文本",
  description: "带作者的引用段落",
  icon: QuoteIcon,
  defaultSize: { width: 520, height: 160 },
  minSize: { width: 160, height: 64 },
  defaultProps: {
    text: "好的设计不是装饰，而是解决问题的方式。",
    author: "— 设计师",
    fontFamily: "",
    fontSize: 18,
    lineHeight: 1.7,
    color: "",
    authorColor: "",
    borderColor: "",
    background: "",
    radius: 12,
    padding: 20,
  },
  fields: [
    { key: "text", label: "引用内容", kind: "textarea", rows: 3 },
    { key: "author", label: "作者", kind: "text" },
    ...fontFields(),
    { key: "color", label: "文字色", kind: "color" },
    { key: "authorColor", label: "作者色", kind: "color" },
    { key: "borderColor", label: "强调线色", kind: "color" },
    { key: "background", label: "背景色", kind: "color" },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 80, step: 1 },
    { key: "padding", label: "内边距", kind: "number", min: 0, max: 100, step: 1 },
  ],
  ai: {
    description: "引用模块，包含引用内容和作者，支持左侧强调线、背景和字体。",
    usage: "用于客户评价、格言、重点摘要。",
  },
  render(module, { theme }) {
    const radius = propNumber(module, "radius", 12);
    return (
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: propNumber(module, "padding", 20), borderLeft: `4px solid ${propString(module, "borderColor") || theme.primary}`, borderRadius: radius, background: propString(module, "background") || "transparent", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, fontFamily: propString(module, "fontFamily") || theme.fontFamily }}>
        <p style={{ margin: 0, color: propString(module, "color") || theme.text, fontSize: propNumber(module, "fontSize", 18), lineHeight: propNumber(module, "lineHeight", 1.7), whiteSpace: "pre-wrap" }}>{propString(module, "text")}</p>
        {propString(module, "author") ? <span style={{ color: propString(module, "authorColor") || theme.muted, fontSize: 12, fontWeight: 500 }}>{propString(module, "author")}</span> : null}
      </div>
    );
  },
  renderHtml(module, { theme }) {
    const radius = propNumber(module, "radius", 12);
    return `<blockquote style="width:100%;height:100%;box-sizing:border-box;margin:0;padding:${propNumber(module, "padding", 20)}px;border-left:4px solid ${htmlAttr(propString(module, "borderColor") || theme.primary)};border-radius:${radius}px;background:${htmlAttr(propString(module, "background") || "transparent")};display:flex;flex-direction:column;justify-content:center;gap:10px;font-family:${htmlAttr(propString(module, "fontFamily") || theme.fontFamily)};"><p style="margin:0;color:${htmlAttr(propString(module, "color") || theme.text)};font-size:${propNumber(module, "fontSize", 18)}px;line-height:${propNumber(module, "lineHeight", 1.7)};white-space:pre-wrap;">${escapeHtml(propString(module, "text"))}</p>${propString(module, "author") ? `<span style="color:${htmlAttr(propString(module, "authorColor") || theme.muted)};font-size:12px;font-weight:500;">${escapeHtml(propString(module, "author"))}</span>` : ""}</blockquote>`;
  },
};

export const progress: ModuleDefinition = {
  type: "core.progress",
  label: "进度条",
  category: "交互",
  description: "带标签和数值的进度条",
  icon: Gauge,
  defaultSize: { width: 320, height: 64 },
  minSize: { width: 120, height: 40 },
  defaultProps: {
    label: "完成度",
    value: 68,
    showValue: true,
    color: "",
    trackColor: "#e8def8",
    height: 10,
    radius: 999,
    fontSize: 12,
    textColor: "",
  },
  fields: [
    { key: "label", label: "标签", kind: "text" },
    { key: "value", label: "数值", kind: "number", min: 0, max: 100, step: 1 },
    { key: "showValue", label: "显示百分比", kind: "boolean" },
    { key: "color", label: "进度颜色", kind: "color", placeholder: "留空跟随主题" },
    { key: "trackColor", label: "轨道颜色", kind: "color" },
    { key: "height", label: "高度", kind: "number", min: 2, max: 40, step: 1 },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 999, step: 1 },
    { key: "fontSize", label: "文字字号", kind: "number", min: 8, max: 28, step: 1 },
    { key: "textColor", label: "文字色", kind: "color" },
  ],
  ai: {
    description: "进度条模块，支持标签、0-100 数值、百分比、颜色、高度和圆角。",
    usage: "用于技能熟练度、项目进度、完成率。",
  },
  render(module, { theme }) {
    const value = clamp(propNumber(module, "value", 0), 0, 100);
    const height = propNumber(module, "height", 10);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: propNumber(module, "fontSize", 12), color: propString(module, "textColor") || theme.text, fontWeight: 550 }}>
          <span>{propString(module, "label")}</span>
          {propBoolean(module, "showValue", false) ? <span>{Math.round(value)}%</span> : null}
        </div>
        <div style={{ width: "100%", height, borderRadius: propNumber(module, "radius", 999), background: propString(module, "trackColor", "#e8def8"), overflow: "hidden" }}>
          <div style={{ width: `${value}%`, height: "100%", borderRadius: propNumber(module, "radius", 999), background: propString(module, "color") || theme.primary }} />
        </div>
      </div>
    );
  },
  renderHtml(module, { theme }) {
    const value = clamp(propNumber(module, "value", 0), 0, 100);
    const height = propNumber(module, "height", 10);
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:7px;"><div style="display:flex;justify-content:space-between;gap:8px;font-size:${propNumber(module, "fontSize", 12)}px;color:${htmlAttr(propString(module, "textColor") || theme.text)};font-weight:550;"><span>${escapeHtml(propString(module, "label"))}</span>${propBoolean(module, "showValue", false) ? `<span>${Math.round(value)}%</span>` : ""}</div><div style="width:100%;height:${height}px;border-radius:${propNumber(module, "radius", 999)}px;background:${htmlAttr(propString(module, "trackColor", "#e8def8"))};overflow:hidden;"><div style="width:${value}%;height:100%;border-radius:${propNumber(module, "radius", 999)}px;background:${htmlAttr(propString(module, "color") || theme.primary)};"></div></div></div>`;
  },
};

export const textarea: ModuleDefinition = {
  type: "core.textarea",
  label: "多行输入",
  category: "交互",
  description: "带标签的多行文本框",
  icon: AlignLeft,
  defaultSize: { width: 360, height: 140 },
  minSize: { width: 120, height: 80 },
  defaultProps: {
    label: "留言",
    placeholder: "请输入内容…",
    rows: 4,
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
    { key: "label", label: "标签", kind: "text" },
    { key: "placeholder", label: "占位文字", kind: "text" },
    { key: "rows", label: "行数", kind: "number", min: 2, max: 20, step: 1 },
    ...fontFields(),
    { key: "labelFontSize", label: "标签字号", kind: "number", min: 8, max: 32, step: 1 },
    { key: "labelFontWeight", label: "标签字重", kind: "number", min: 100, max: 900, step: 100 },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 100, step: 1 },
    { key: "labelColor", label: "标签色", kind: "color" },
    { key: "textColor", label: "文字色", kind: "color" },
    { key: "background", label: "背景色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color" },
  ],
  ai: {
    description: "多行文本输入框，支持标签、占位文字、行数、字体和颜色。",
    usage: "用于留言、反馈、详细描述等长文本输入。",
  },
  render(module, { theme }) {
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const textColor = propString(module, "textColor") || theme.text;
    const labelColor = propString(module, "labelColor") || theme.muted;
    const background = propString(module, "background") || "#f7f2fa";
    const borderColor = propString(module, "borderColor") || "#cac4d0";
    const radius = propNumber(module, "radius", 8);
    return (
      <label style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, fontFamily, color: textColor }}>
        <span style={{ fontSize: propNumber(module, "labelFontSize", 12), fontWeight: propNumber(module, "labelFontWeight", 600), color: labelColor }}>{propString(module, "label")}</span>
        <textarea readOnly tabIndex={-1} rows={propNumber(module, "rows", 4)} placeholder={propString(module, "placeholder")} style={{ flex: 1, minHeight: 0, width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: radius, border: `1px solid ${borderColor}`, background, color: textColor, fontSize: propNumber(module, "fontSize", 14), fontWeight: propNumber(module, "fontWeight", 400), outline: "none", resize: "none", pointerEvents: "none" }} />
      </label>
    );
  },
  renderHtml(module, { theme }) {
    const fontFamily = propString(module, "fontFamily") || theme.fontFamily;
    const textColor = propString(module, "textColor") || theme.text;
    const labelColor = propString(module, "labelColor") || theme.muted;
    const background = propString(module, "background") || "#f7f2fa";
    const borderColor = propString(module, "borderColor") || "#cac4d0";
    const radius = propNumber(module, "radius", 8);
    return `<label style="display:flex;width:100%;height:100%;box-sizing:border-box;flex-direction:column;gap:6px;font-family:${htmlAttr(fontFamily)};color:${htmlAttr(textColor)};"><span style="font-size:${propNumber(module, "labelFontSize", 12)}px;font-weight:${propNumber(module, "labelFontWeight", 600)};color:${htmlAttr(labelColor)};">${escapeHtml(propString(module, "label"))}</span><textarea rows="${propNumber(module, "rows", 4)}" placeholder="${htmlAttr(propString(module, "placeholder"))}" style="flex:1;min-height:0;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:${radius}px;border:1px solid ${htmlAttr(borderColor)};background:${htmlAttr(background)};color:${htmlAttr(textColor)};font-size:${propNumber(module, "fontSize", 14)}px;font-weight:${propNumber(module, "fontWeight", 400)};outline:none;resize:vertical;"></textarea></label>`;
  },
};

export const select: ModuleDefinition = {
  type: "core.select",
  label: "下拉选择",
  category: "交互",
  description: "带标签的下拉选项",
  icon: ListFilter,
  defaultSize: { width: 320, height: 80 },
  minSize: { width: 120, height: 52 },
  defaultProps: {
    label: "选择",
    options: "选项一\n选项二\n选项三",
    placeholder: "请选择",
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
    { key: "label", label: "标签", kind: "text" },
    { key: "options", label: "选项", kind: "textarea", rows: 4, placeholder: "每行一个选项" },
    { key: "placeholder", label: "占位文字", kind: "text" },
    ...fontFields(),
    { key: "labelFontSize", label: "标签字号", kind: "number", min: 8, max: 32, step: 1 },
    { key: "labelFontWeight", label: "标签字重", kind: "number", min: 100, max: 900, step: 100 },
    { key: "radius", label: "圆角", kind: "number", min: 0, max: 100, step: 1 },
    { key: "labelColor", label: "标签色", kind: "color" },
    { key: "textColor", label: "文字色", kind: "color" },
    { key: "background", label: "背景色", kind: "color" },
    { key: "borderColor", label: "边框色", kind: "color" },
  ],
  ai: {
    description: "下拉选择框，支持标签、每行一个选项、占位文字和字体颜色。",
    usage: "用于表单中的单选项、分类选择。",
  },
  render(module, { theme }) {
    const options = propString(module, "options").split(/\r?\n/).filter((item) => item.trim());
    const textColor = propString(module, "textColor") || theme.text;
    return (
      <label style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, fontFamily: propString(module, "fontFamily") || theme.fontFamily, color: textColor }}>
        <span style={{ fontSize: propNumber(module, "labelFontSize", 12), fontWeight: propNumber(module, "labelFontWeight", 600), color: propString(module, "labelColor") || theme.muted }}>{propString(module, "label")}</span>
        <select disabled value="" style={{ width: "100%", height: 40, boxSizing: "border-box", padding: "0 12px", borderRadius: propNumber(module, "radius", 8), border: `1px solid ${propString(module, "borderColor") || "#cac4d0"}`, background: propString(module, "background") || "#f7f2fa", color: textColor, fontSize: propNumber(module, "fontSize", 14), fontWeight: propNumber(module, "fontWeight", 400), pointerEvents: "none" }}>
          <option value="">{propString(module, "placeholder", "请选择")}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  },
  renderHtml(module, { theme }) {
    const options = propString(module, "options").split(/\r?\n/).filter((item) => item.trim());
    const textColor = propString(module, "textColor") || theme.text;
    const labelColor = propString(module, "labelColor") || theme.muted;
    return `<label style="display:flex;width:100%;height:100%;box-sizing:border-box;flex-direction:column;justify-content:center;gap:6px;font-family:${htmlAttr(propString(module, "fontFamily") || theme.fontFamily)};color:${htmlAttr(textColor)};"><span style="font-size:${propNumber(module, "labelFontSize", 12)}px;font-weight:${propNumber(module, "labelFontWeight", 600)};color:${htmlAttr(labelColor)};">${escapeHtml(propString(module, "label"))}</span><select style="width:100%;height:40px;box-sizing:border-box;padding:0 12px;border-radius:${propNumber(module, "radius", 8)}px;border:1px solid ${htmlAttr(propString(module, "borderColor") || "#cac4d0")};background:${htmlAttr(propString(module, "background") || "#f7f2fa")};color:${htmlAttr(textColor)};font-size:${propNumber(module, "fontSize", 14)}px;font-weight:${propNumber(module, "fontWeight", 400)};outline:none;"><option value="">${escapeHtml(propString(module, "placeholder", "请选择"))}</option>${options.map((option) => `<option value="${htmlAttr(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
  },
};

export const checkbox: ModuleDefinition = {
  type: "core.checkbox",
  label: "复选框",
  category: "交互",
  description: "单个复选选项",
  icon: CircleCheck,
  defaultSize: { width: 240, height: 32 },
  minSize: { width: 80, height: 24 },
  defaultProps: {
    label: "同意条款",
    checked: false,
    color: "",
    textColor: "",
    fontSize: 14,
    fontWeight: 400,
    size: 18,
    gap: 8,
  },
  fields: [
    { key: "label", label: "文字", kind: "text" },
    { key: "checked", label: "默认选中", kind: "boolean" },
    { key: "color", label: "选中颜色", kind: "color", placeholder: "留空跟随主题" },
    { key: "textColor", label: "文字色", kind: "color" },
    { key: "fontSize", label: "字号", kind: "number", min: 8, max: 28, step: 1 },
    { key: "fontWeight", label: "字重", kind: "number", min: 100, max: 900, step: 100 },
    { key: "size", label: "选框大小", kind: "number", min: 10, max: 40, step: 1 },
    { key: "gap", label: "间距", kind: "number", min: 0, max: 24, step: 1 },
  ],
  ai: {
    description: "单个复选框，支持默认选中、尺寸、间距和颜色。",
    usage: "用于同意条款、开关选项、表单勾选。",
  },
  render(module, { theme }) {
    const size = propNumber(module, "size", 18);
    return (
      <label style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: propNumber(module, "gap", 8), color: propString(module, "textColor") || theme.text, fontSize: propNumber(module, "fontSize", 14), fontWeight: propNumber(module, "fontWeight", 400), fontFamily: theme.fontFamily }}>
        <input type="checkbox" checked={propBoolean(module, "checked", false)} readOnly tabIndex={-1} style={{ width: size, height: size, margin: 0, accentColor: propString(module, "color") || theme.primary, pointerEvents: "none" }} />
        {propString(module, "label")}
      </label>
    );
  },
  renderHtml(module, { theme }) {
    const size = propNumber(module, "size", 18);
    return `<label style="display:flex;width:100%;height:100%;align-items:center;gap:${propNumber(module, "gap", 8)}px;color:${htmlAttr(propString(module, "textColor") || theme.text)};font-size:${propNumber(module, "fontSize", 14)}px;font-weight:${propNumber(module, "fontWeight", 400)};font-family:${htmlAttr(theme.fontFamily)};"><input type="checkbox"${propBoolean(module, "checked", false) ? " checked" : ""} style="width:${size}px;height:${size}px;margin:0;accent-color:${htmlAttr(propString(module, "color") || theme.primary)};" />${escapeHtml(propString(module, "label"))}</label>`;
  },
};

export const extraModules: ModuleDefinition[] = [
  card,
  link,
  badge,
  avatar,
  video,
  list,
  quote,
  progress,
  textarea,
  select,
  checkbox,
];
