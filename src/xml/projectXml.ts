import { DEFAULT_THEME, createId } from "../model/defaults";
import {
  DEFAULT_ANIMATION,
  hasAnimationTrigger,
  hasAnimations,
  normalizeAnimation,
  normalizeTrigger,
} from "../model/animations";
import {
  KEYFRAME_PROPERTIES,
  hasKeyframes,
  normalizeKeyframeAnimation,
} from "../model/keyframes";
import type {
  AnchorX,
  AnchorY,
  AnimationConfig,
  AnimationGroup,
  AnimationTrigger,
  Keyframe,
  KeyframeAnimation,
  KeyframeProperty,
  ModuleNode,
  ProjectTemplate,
  Page,
  Project,
  ProjectType,
  PropValue,
  ScriptBlock,
  ScriptBoard,
  ScriptBlockKind,
  Theme,
} from "../model/types";
import { escapeXmlAttr, wrapCdata } from "../lib/escape";
import { normalizeAnimationGroup } from "../model/animationGroups";

export class ProjectXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectXmlError";
  }
}

const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function fail(message: string): never {
  throw new ProjectXmlError(message);
}

function directChildren(element: Element, tag?: string): Element[] {
  const result: Element[] = [];
  for (const child of Array.from(element.children)) {
    if (!tag || child.tagName === tag) {
      result.push(child);
    }
  }
  return result;
}

function readAttr(element: Element, name: string): string | null {
  return element.hasAttribute(name) ? element.getAttribute(name) : null;
}

function requiredAttr(element: Element, name: string, context: string): string {
  const value = readAttr(element, name);
  if (value === null || value.trim() === "") {
    fail(`${context} 缺少必需属性 "${name}"`);
  }
  return value;
}

function numberAttr(
  element: Element,
  name: string,
  context: string,
  fallback?: number,
): number {
  const raw = readAttr(element, name);
  if (raw === null || raw.trim() === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    fail(`${context} 缺少数字属性 "${name}"`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    fail(`${context} 的属性 "${name}" 不是有效数字`);
  }
  return value;
}

function parseProp(element: Element, context: string): PropValue {
  const type = readAttr(element, "type") ?? "string";
  const text = element.textContent ?? "";

  if (type === "string") {
    return text;
  }
  if (type === "number") {
    const value = Number(text.trim());
    if (!Number.isFinite(value)) {
      fail(`${context} 的属性 "${element.tagName}" 不是有效数字`);
    }
    return value;
  }
  if (type === "boolean") {
    const normalized = text.trim();
    if (normalized !== "true" && normalized !== "false") {
      fail(`${context} 的属性 "${element.tagName}" 不是有效布尔值`);
    }
    return normalized === "true";
  }
  if (type === "null") {
    return null;
  }
  if (type === "json") {
    try {
      return JSON.parse(text) as PropValue;
    } catch {
      fail(`${context} 的属性 "${element.tagName}" 不是有效 JSON`);
    }
  }

  return text;
}

function parseAnimations(element: Element | undefined): AnimationConfig | undefined {
  if (!element) {
    return undefined;
  }
  const animations = normalizeAnimation({
    entrance: readAttr(element, "entrance") ?? "",
    loop: readAttr(element, "loop") ?? "",
    exit: readAttr(element, "exit") ?? "",
    duration: numberAttr(
      element,
      "duration",
      "动画设置",
      DEFAULT_ANIMATION.duration,
    ),
    delay: numberAttr(element, "delay", "动画设置", DEFAULT_ANIMATION.delay),
    exitDelay: numberAttr(
      element,
      "exit-delay",
      "动画设置",
      DEFAULT_ANIMATION.exitDelay,
    ),
    easing: readAttr(element, "easing") ?? DEFAULT_ANIMATION.easing,
  });
  return hasAnimations(animations) ? animations : undefined;
}

function parseAnimationTrigger(
  element: Element | undefined,
): AnimationTrigger | undefined {
  if (!element) {
    return undefined;
  }
  const trigger = normalizeTrigger({
    type: readAttr(element, "type") as AnimationTrigger["type"],
    moduleId: readAttr(element, "module") ?? undefined,
    property: readAttr(element, "property") as AnimationTrigger["property"],
    attribute: readAttr(element, "attribute") ?? undefined,
    operator: readAttr(element, "operator") as AnimationTrigger["operator"],
    value: readAttr(element, "value") ?? undefined,
    code: directChildren(element, "code")[0]?.textContent ?? undefined,
  });
  return hasAnimationTrigger(trigger) ? trigger : undefined;
}

function parseAnimationGroups(
  element: Element | undefined,
): AnimationGroup[] | undefined {
  if (!element) {
    return undefined;
  }
  const groups = directChildren(element, "animation-group").map((group) =>
    normalizeAnimationGroup({
      id: readAttr(group, "id")?.trim() || createId("anim"),
      name: readAttr(group, "name") ?? "动画",
      enabled: readAttr(group, "enabled") !== "false",
      animations: parseAnimations(directChildren(group, "animations")[0]),
      keyframes: parseKeyframes(directChildren(group, "keyframes")[0]),
      triggers: directChildren(group, "animation-trigger")
        .map(parseAnimationTrigger)
        .filter((trigger): trigger is AnimationTrigger => Boolean(trigger)),
    }),
  );
  return groups.length > 0 ? groups : undefined;
}

function parseKeyframes(element: Element | undefined): KeyframeAnimation | undefined {
  if (!element) {
    return undefined;
  }
  const tracks: Record<string, Keyframe[]> = {};
  for (const trackElement of directChildren(element, "track")) {
    const property = readAttr(trackElement, "property") as KeyframeProperty;
    if (!property) {
      continue;
    }
    const keyframes = directChildren(trackElement, "keyframe").map(
      (keyframeElement) => ({
        id:
          readAttr(keyframeElement, "id")?.trim() || createId("kf"),
        time: numberAttr(keyframeElement, "time", "关键帧", 0),
        value: numberAttr(keyframeElement, "value", "关键帧", 0),
        easing:
          readAttr(keyframeElement, "easing") ??
          "cubic-bezier(0.2, 0, 0, 1)",
      }),
    );
    if (keyframes.length > 0) {
      tracks[property] = keyframes;
    }
  }
  const config = normalizeKeyframeAnimation({
    duration: numberAttr(element, "duration", "关键帧", 3000),
    loop: readAttr(element, "loop") !== "false",
    tracks,
  });
  return hasKeyframes(config) ? config : undefined;
}

function parseScriptBoard(
  element: Element | undefined,
): ScriptBoard | undefined {
  if (!element) {
    return undefined;
  }
  const blocks: ScriptBlock[] = directChildren(element, "block")
    .map((block) => {
      const id = readAttr(block, "id")?.trim();
      if (!id) {
        return null;
      }
      const codeElement = directChildren(block, "code")[0];
      const fieldsElement = directChildren(block, "fields")[0];
      const fields = fieldsElement
        ? directChildren(fieldsElement, "field").reduce<Record<string, string>>(
            (result, field) => {
              const key = readAttr(field, "key")?.trim();
              if (key) {
                result[key] = field.textContent ?? "";
              }
              return result;
            },
            {},
          )
        : undefined;
      return {
        id,
        kind: (readAttr(block, "kind") ?? "custom") as ScriptBlockKind,
        title: readAttr(block, "title") ?? "积木",
        code: codeElement?.textContent ?? "",
        ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
        x: numberAttr(block, "x", "脚本积木", 0),
        y: numberAttr(block, "y", "脚本积木", 0),
        width: Math.max(numberAttr(block, "width", "脚本积木", 260), 120),
        height: Math.max(numberAttr(block, "height", "脚本积木", 168), 80),
      };
    })
    .filter((block): block is ScriptBlock => Boolean(block));
  const blockIds = new Set(blocks.map((block) => block.id));
  const connections = directChildren(element, "connection")
    .map((connection) => {
      const id = readAttr(connection, "id")?.trim();
      const from = readAttr(connection, "from")?.trim();
      const to = readAttr(connection, "to")?.trim();
      if (!id || !from || !to || !blockIds.has(from) || !blockIds.has(to)) {
        return null;
      }
      return { id, from, to };
    })
    .filter((connection): connection is NonNullable<typeof connection> =>
      Boolean(connection),
    );
  return blocks.length > 0 || connections.length > 0
    ? { blocks, connections }
    : undefined;
}

function parseModule(element: Element, pageContext: string): ModuleNode {
  const id = requiredAttr(element, "id", pageContext);
  const type = requiredAttr(element, "type", pageContext);
  const context = `${pageContext} 模块 "${id}"`;
  const propsElement = directChildren(element, "props")[0];
  const props: Record<string, PropValue> = {};

  if (propsElement) {
    for (const child of directChildren(propsElement)) {
      if (!XML_NAME.test(child.tagName)) {
        continue;
      }
      props[child.tagName] = parseProp(child, context);
    }
  }

  const animations = parseAnimations(directChildren(element, "animations")[0]);
  const keyframes = parseKeyframes(directChildren(element, "keyframes")[0]);
  const animationTrigger = parseAnimationTrigger(
    directChildren(element, "animation-trigger")[0],
  );
  const animationGroups = parseAnimationGroups(
    directChildren(element, "animation-groups")[0],
  );
  const anchorXRaw = readAttr(element, "anchor-x");
  const anchorYRaw = readAttr(element, "anchor-y");
  const anchorX: AnchorX = anchorXRaw === "right" ? "right" : "left";
  const anchorY: AnchorY = anchorYRaw === "bottom" ? "bottom" : "top";

  return {
    id,
    type,
    x: numberAttr(element, "x", context, 0),
    y: numberAttr(element, "y", context, 0),
    width: Math.max(numberAttr(element, "width", context, 1), 1),
    height: Math.max(numberAttr(element, "height", context, 1), 1),
    props,
    ...(anchorX === "right" ? { anchorX } : {}),
    ...(anchorY === "bottom" ? { anchorY } : {}),
    ...(animations ? { animations } : {}),
    ...(keyframes ? { keyframes } : {}),
    ...(animationTrigger ? { animationTrigger } : {}),
    ...(animationGroups ? { animationGroups } : {}),
  };
}

function parsePage(element: Element): Page {
  const id = requiredAttr(element, "id", "页面");
  const context = `页面 "${id}"`;
  const width = Math.max(numberAttr(element, "width", context, 1200), 1);
  const height = Math.max(numberAttr(element, "height", context, 1200), 1);
  const grid = Math.max(numberAttr(element, "grid", context, 16), 1);
  const modules = directChildren(element, "module").map((module) =>
    parseModule(module, context),
  );
  const moduleIds = new Set<string>();
  for (const module of modules) {
    if (moduleIds.has(module.id)) {
      fail(`${context} 存在重复模块 ID "${module.id}"`);
    }
    moduleIds.add(module.id);
  }

  const animations = parseAnimations(directChildren(element, "animations")[0]);
  const keyframes = parseKeyframes(directChildren(element, "keyframes")[0]);
  const animationTrigger = parseAnimationTrigger(
    directChildren(element, "animation-trigger")[0],
  );
  const animationGroups = parseAnimationGroups(
    directChildren(element, "animation-groups")[0],
  );
  const scriptBoard = parseScriptBoard(
    directChildren(element, "script-board")[0],
  );
  const customScriptElement = directChildren(element, "custom-script")[0];
  const customScript = customScriptElement?.textContent ?? "";
  const scriptLanguage =
    readAttr(customScriptElement ?? element, "language") === "typescript"
      ? ("typescript" as const)
      : undefined;

  return {
    id,
    title: readAttr(element, "title") ?? "未命名页面",
    width,
    height,
    grid,
    background: readAttr(element, "background") ?? "#ffffff",
    modules,
    ...(customScript ? { customScript } : {}),
    ...(scriptLanguage ? { scriptLanguage } : {}),
    ...(animations ? { animations } : {}),
    ...(keyframes ? { keyframes } : {}),
    ...(animationTrigger ? { animationTrigger } : {}),
    ...(animationGroups ? { animationGroups } : {}),
    ...(scriptBoard ? { scriptBoard } : {}),
  };
}

function parseTheme(element: Element | undefined): Theme {
  if (!element) {
    return { ...DEFAULT_THEME };
  }
  return {
    fontFamily: readAttr(element, "font-family") ?? DEFAULT_THEME.fontFamily,
    primary: readAttr(element, "primary") ?? DEFAULT_THEME.primary,
    text: readAttr(element, "text") ?? DEFAULT_THEME.text,
    muted: readAttr(element, "muted") ?? DEFAULT_THEME.muted,
    surface: readAttr(element, "surface") ?? DEFAULT_THEME.surface,
  };
}

export function parseProjectXml(xml: string): Project {
  if (!xml.trim()) {
    fail("XML 内容为空");
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserError =
    document.querySelector("parsererror") ??
    document.getElementsByTagName("parsererror")[0];

  if (parserError) {
    fail(`XML 解析失败：${parserError.textContent?.trim() || "格式错误"}`);
  }

  const root = document.documentElement;
  if (!root || root.tagName !== "spark-pages") {
    fail('根元素必须是 <spark-pages>');
  }

  const version = Number(readAttr(root, "version") ?? "1");
  if (version !== 1) {
    fail(`不支持的 XML 版本：${version}`);
  }

  const pages = directChildren(root, "page").map(parsePage);
  if (pages.length === 0) {
    fail("XML 中至少需要一个 <page>");
  }

  const pageIds = new Set<string>();
  for (const page of pages) {
    if (pageIds.has(page.id)) {
      fail(`存在重复页面 ID "${page.id}"`);
    }
    pageIds.add(page.id);
  }

  const typeRaw = readAttr(root, "type") ?? "html";
  const type: ProjectType =
    typeRaw === "vue" || typeRaw === "nodejs" ? "vue" : "html";
  // Legacy files used type="nodejs" for Vite projects; treat them as Vue+TS.
  const legacyTemplate = readAttr(root, "node-template");
  const templateRaw = readAttr(root, "template") ?? legacyTemplate;
  const template: ProjectTemplate =
    type === "vue" || templateRaw === "vite-vue-ts"
      ? "vite-vue-ts"
      : "static";

  return {
    version: 1,
    name: readAttr(root, "name")?.trim() || "未命名项目",
    description: readAttr(root, "description") ?? "",
    type,
    template,
    theme: parseTheme(directChildren(root, "theme")[0]),
    pages,
  };
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function attr(name: string, value: string | number): string {
  return ` ${name}="${escapeXmlAttr(String(value))}"`;
}

function serializeProp(key: string, value: PropValue, level: number): string[] {
  if (!XML_NAME.test(key)) {
    fail(`属性名 "${key}" 不是有效的 XML 名称`);
  }
  const pad = indent(level);

  if (value === null) {
    return [`${pad}<${key} type="null" />`];
  }
  if (typeof value === "string") {
    if (value === "") {
      return [`${pad}<${key}></${key}>`];
    }
    return [`${pad}<${key}>${wrapCdata(value)}</${key}>`];
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(`属性 "${key}" 包含无效数字`);
    }
    return [`${pad}<${key} type="number">${value}</${key}>`];
  }
  if (typeof value === "boolean") {
    return [`${pad}<${key} type="boolean">${value}</${key}>`];
  }
  return [
    `${pad}<${key} type="json">${wrapCdata(JSON.stringify(value))}</${key}>`,
  ];
}

function serializeAnimations(
  config: AnimationConfig | undefined,
  level: number,
): string[] {
  if (!config || !hasAnimations(config)) {
    return [];
  }
  const pad = indent(level);
  return [
    `${pad}<animations${attr("entrance", config.entrance)}${attr("loop", config.loop)}${attr("exit", config.exit)}${attr("duration", config.duration)}${attr("delay", config.delay)}${attr("exit-delay", config.exitDelay)}${attr("easing", config.easing)} />`,
  ];
}

function serializeAnimationTrigger(
  trigger: AnimationTrigger | undefined,
  level: number,
): string[] {
  if (!trigger || !hasAnimationTrigger(trigger)) {
    return [];
  }
  const pad = indent(level);
  const attrs =
    attr("type", trigger.type) +
    (trigger.type === "condition"
      ? attr("module", trigger.moduleId ?? "") +
        attr("property", trigger.property ?? "") +
        attr("attribute", trigger.attribute ?? "") +
        attr("operator", trigger.operator ?? "") +
        attr("value", trigger.value ?? "")
      : "");
  if (trigger.type === "custom") {
    return [
      `${pad}<animation-trigger${attrs}>`,
      `${pad}  <code>${wrapCdata(trigger.code ?? "")}</code>`,
      `${pad}</animation-trigger>`,
    ];
  }
  return [`${pad}<animation-trigger${attrs} />`];
}

function serializeAnimationGroups(
  groups: AnimationGroup[] | undefined,
  level: number,
): string[] {
  if (!groups || groups.length === 0) {
    return [];
  }
  const pad = indent(level);
  const lines = [`${pad}<animation-groups>`];
  for (const group of groups) {
    lines.push(
      `${pad}  <animation-group${attr("id", group.id)}${attr("name", group.name)}${group.enabled === false ? attr("enabled", "false") : ""}>`,
    );
    lines.push(...serializeAnimations(group.animations, level + 2));
    lines.push(...serializeKeyframes(group.keyframes, level + 2));
    for (const trigger of group.triggers) {
      lines.push(...serializeAnimationTrigger(trigger, level + 2));
    }
    lines.push(`${pad}  </animation-group>`);
  }
  lines.push(`${pad}</animation-groups>`);
  return lines;
}

function serializeKeyframes(
  config: KeyframeAnimation | undefined,
  level: number,
): string[] {
  if (!config || !hasKeyframes(config)) {
    return [];
  }
  const pad = indent(level);
  const lines = [
    `${pad}<keyframes${attr("duration", config.duration)}${attr("loop", config.loop ? "true" : "false")}>`,
  ];
  const entries = Object.entries(config.tracks).sort(([a], [b]) => {
    const orderA = KEYFRAME_PROPERTIES.findIndex((item) => item.key === a);
    const orderB = KEYFRAME_PROPERTIES.findIndex((item) => item.key === b);
    return (orderA < 0 ? 999 : orderA) - (orderB < 0 ? 999 : orderB);
  });
  for (const [property, track] of entries) {
    if (!track || track.length === 0) {
      continue;
    }
    lines.push(`${pad}  <track${attr("property", property)}>`);
    for (const keyframe of [...track].sort((a, b) => a.time - b.time)) {
      lines.push(
        `${pad}    <keyframe${attr("id", keyframe.id)}${attr("time", keyframe.time)}${attr("value", keyframe.value)}${attr("easing", keyframe.easing)} />`,
      );
    }
    lines.push(`${pad}  </track>`);
  }
  lines.push(`${pad}</keyframes>`);
  return lines;
}

function serializeScriptBoard(
  board: ScriptBoard | undefined,
  level: number,
): string[] {
  if (!board || (board.blocks.length === 0 && board.connections.length === 0)) {
    return [];
  }
  const pad = indent(level);
  const lines = [`${pad}<script-board>`];
  for (const block of board.blocks) {
    lines.push(
      `${pad}  <block${attr("id", block.id)}${attr("kind", block.kind)}${attr("title", block.title)}${attr("x", block.x)}${attr("y", block.y)}${attr("width", block.width)}${attr("height", block.height)}>`,
    );
    lines.push(`${pad}    <code>${wrapCdata(block.code)}</code>`);
    if (block.fields && Object.keys(block.fields).length > 0) {
      lines.push(`${pad}    <fields>`);
      for (const [key, value] of Object.entries(block.fields)) {
        lines.push(
          `${pad}      <field${attr("key", key)}>${wrapCdata(value)}</field>`,
        );
      }
      lines.push(`${pad}    </fields>`);
    }
    lines.push(`${pad}  </block>`);
  }
  for (const connection of board.connections) {
    lines.push(
      `${pad}  <connection${attr("id", connection.id)}${attr("from", connection.from)}${attr("to", connection.to)} />`,
    );
  }
  lines.push(`${pad}</script-board>`);
  return lines;
}

function serializeModule(module: ModuleNode, level: number): string[] {
  const pad = indent(level);
  const anchorAttrs =
    (module.anchorX === "right" ? attr("anchor-x", "right") : "") +
    (module.anchorY === "bottom" ? attr("anchor-y", "bottom") : "");
  const lines = [
    `${pad}<module${attr("id", module.id)}${attr("type", module.type)}${attr("x", module.x)}${attr("y", module.y)}${attr("width", module.width)}${attr("height", module.height)}${anchorAttrs}>`,
  ];
  const childLines: string[] = [];
  childLines.push(...serializeKeyframes(module.keyframes, level + 1));
  if (module.animationGroups?.length) {
    childLines.push(...serializeAnimationGroups(module.animationGroups, level + 1));
  } else {
    childLines.push(...serializeAnimations(module.animations, level + 1));
    childLines.push(...serializeAnimationTrigger(module.animationTrigger, level + 1));
  }
  const entries = Object.entries(module.props);
  if (entries.length > 0) {
    childLines.push(`${pad}  <props>`);
    for (const [key, value] of entries) {
      childLines.push(...serializeProp(key, value, level + 2));
    }
    childLines.push(`${pad}  </props>`);
  }
  if (childLines.length === 0) {
    lines[0] = `${lines[0].slice(0, -1)} />`;
    return lines;
  }
  lines.push(...childLines);
  lines.push(`${pad}</module>`);
  return lines;
}

function serializePage(page: Page, level: number): string[] {
  const pad = indent(level);
  const lines = [
    `${pad}<page${attr("id", page.id)}${attr("title", page.title)}${attr("width", page.width)}${attr("height", page.height)}${attr("grid", page.grid)}${attr("background", page.background)}>`,
  ];
  lines.push(...serializeKeyframes(page.keyframes, level + 1));
  if (page.animationGroups?.length) {
    lines.push(...serializeAnimationGroups(page.animationGroups, level + 1));
  } else {
    lines.push(...serializeAnimations(page.animations, level + 1));
    lines.push(...serializeAnimationTrigger(page.animationTrigger, level + 1));
  }
  lines.push(...serializeScriptBoard(page.scriptBoard, level + 1));
  if (page.customScript) {
    lines.push(
      `${pad}  <custom-script${attr("language", page.scriptLanguage === "typescript" ? "typescript" : "javascript")}>${wrapCdata(page.customScript)}</custom-script>`,
    );
  }
  for (const module of page.modules) {
    lines.push(...serializeModule(module, level + 1));
  }
  lines.push(`${pad}</page>`);
  return lines;
}

export function serializeProject(project: Project): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<spark-pages${attr("version", project.version)}${attr("name", project.name)}${attr("type", project.type)}${attr("template", project.template)}${attr("description", project.description)}>`,
    `${indent(1)}<theme${attr("font-family", project.theme.fontFamily)}${attr("primary", project.theme.primary)}${attr("text", project.theme.text)}${attr("muted", project.theme.muted)}${attr("surface", project.theme.surface)} />`,
  ];
  for (const page of project.pages) {
    lines.push(...serializePage(page, 1));
  }
  lines.push("</spark-pages>");
  return `${lines.join("\n")}\n`;
}
