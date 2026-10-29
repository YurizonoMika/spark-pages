import type { Page, Project } from "../model/types";
import { getModuleDefinitionSafe } from "../modules/registry";
import { escapeHtml, htmlAttr } from "./escape";
import { rectOf } from "./geometry";
import { ANIMATION_CSS, wrapAnimatedHtml } from "./animation";
import { hasAnimations } from "../model/animations";
import { hasKeyframes } from "../model/keyframes";
import { animationGroupsOf } from "../model/animationGroups";
import { buildKeyframeAnimation } from "./keyframes";

const PREVIEW_BRIDGE = String.raw`<script>
(function () {
  var APP_SOURCE = "spark-pages-app";
  var PREVIEW_SOURCE = "spark-pages-preview";
  var wandActive = false;
  var selected = [];
  var hovered = null;

  function post(type, id) {
    parent.postMessage({ source: PREVIEW_SOURCE, type: type, id: id || null }, "*");
  }
  function moduleAt(x, y) {
    var element = document.elementFromPoint(x, y);
    return element && element.closest
      ? element.closest("[data-spark-module-id]")
      : null;
  }
  function clearHover() {
    if (hovered) hovered.classList.remove("spark-wand-hover");
    hovered = null;
  }
  function applySelection(ids) {
    selected = Array.isArray(ids) ? ids : [];
    var nodes = document.querySelectorAll("[data-spark-module-id]");
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      node.classList.toggle(
        "spark-wand-selected",
        selected.indexOf(node.getAttribute("data-spark-module-id")) !== -1,
      );
    }
  }
  function hoverAt(x, y) {
    var target = wandActive ? moduleAt(x, y) : null;
    if (target === hovered) return;
    clearHover();
    if (target) {
      hovered = target;
      target.classList.add("spark-wand-hover");
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.source !== APP_SOURCE) return;
    if (data.type === "wand") {
      wandActive = Boolean(data.active);
      if (!wandActive) clearHover();
    } else if (data.type === "selection") {
      applySelection(data.ids);
    } else if (data.type === "hover") {
      hoverAt(data.x, data.y);
    } else if (data.type === "clear-hover") {
      clearHover();
    } else if (data.type === "select") {
      var target = wandActive ? moduleAt(data.x, data.y) : null;
      var id = target && target.getAttribute("data-spark-module-id");
      if (id) {
        applySelection([id]);
        post("select", id);
      }
    }
  });

  post("ready");
})();
</script>`;

const ANIMATION_TRIGGER_SCRIPT = String.raw`<script>
(function () {
  var roots = document.querySelectorAll("[data-spark-anim-triggers]");
  if (!roots.length) return;

  function layersOf(root) {
    var layers = [];
    if (
      root.classList.contains("spark-anim-layer") ||
      root.classList.contains("spark-kf-layer")
    ) {
      layers.push(root);
    }
    var nested = root.querySelectorAll(".spark-anim-layer, .spark-kf-layer");
    for (var index = 0; index < nested.length; index += 1) {
      layers.push(nested[index]);
    }
    return layers;
  }

  function play(root) {
    var layers = layersOf(root);
    var group = root.getAttribute("data-spark-anim-group");
    for (var index = 0; index < layers.length; index += 1) {
      if (
        group &&
        layers[index].getAttribute("data-spark-anim-group") !== group
      ) {
        continue;
      }
      var style = layers[index].getAttribute("data-spark-anim-style");
      if (!style) continue;
      layers[index].style.animation = "none";
      void layers[index].offsetWidth;
      layers[index].style.animation = style + "animation-play-state:running;";
    }
  }

  function readValue(element, trigger) {
    if (!element) return "";
    if (trigger.property === "text") {
      return (element.textContent || "").trim();
    }
    if (trigger.property === "attribute") {
      return element.getAttribute(trigger.attribute || "") || "";
    }
    var control = element.matches("input, textarea, select")
      ? element
      : element.querySelector("input, textarea, select");
    if (control && typeof control.value === "string") {
      return control.value;
    }
    var dataValue = element.getAttribute("data-spark-value");
    if (dataValue !== null) return dataValue;
    return (element.textContent || "").trim();
  }

  function compare(actual, operator, expected) {
    var left = String(actual == null ? "" : actual).trim();
    var right = String(expected == null ? "" : expected).trim();
    var leftNumber = Number(left);
    var rightNumber = Number(right);
    var bothNumbers =
      left !== "" &&
      right !== "" &&
      isFinite(leftNumber) &&
      isFinite(rightNumber);
    var a = bothNumbers ? leftNumber : left;
    var b = bothNumbers ? rightNumber : right;
    if (operator === "eq") return a === b;
    if (operator === "lt") return a < b;
    return a > b;
  }

  function moduleElements() {
    var result = {};
    var nodes = document.querySelectorAll("[data-spark-module-id]");
    for (var index = 0; index < nodes.length; index += 1) {
      result[nodes[index].getAttribute("data-spark-module-id")] = nodes[index];
    }
    return result;
  }

  function evaluateCondition(root, trigger) {
    var source = trigger.moduleId
      ? document.getElementById(trigger.moduleId)
      : null;
    if (!source) return false;
    return compare(
      readValue(source, trigger),
      trigger.operator || "eq",
      trigger.value || "",
    );
  }

  function evaluateCustom(root, trigger, event) {
    try {
      var host =
        root.closest("[data-spark-module-id]") ||
        document.querySelector(".spark-page") ||
        root;
      var run = new Function(
        "element",
        "modules",
        "event",
        trigger.code || "return false;",
      );
      return Boolean(run.call(host, host, moduleElements(), event || null));
    } catch (error) {
      if (window.console) {
        console.warn("Spark 动画触发条件执行失败", error);
      }
      return false;
    }
  }

  function parseTriggers(root) {
    try {
      var parsed = JSON.parse(
        root.getAttribute("data-spark-anim-triggers") || "[]",
      );
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  for (var index = 0; index < roots.length; index += 1) {
    (function (root) {
      var triggers = parseTriggers(root);
      if (!triggers.length) return;
      var hasClick = triggers.some(function (trigger) {
        return trigger.type === "click";
      });
      var hasHover = triggers.some(function (trigger) {
        return trigger.type === "hover";
      });
      if (hasClick) {
        root.addEventListener("click", function () {
          play(root);
        });
      }
      if (hasHover) {
        root.addEventListener("mouseenter", function () {
          play(root);
        });
      }
      var polled = triggers.filter(function (trigger) {
        return trigger.type === "condition" || trigger.type === "custom";
      });
      if (!polled.length) return;
      var active = false;
      function check(event) {
        var matched = polled.some(function (trigger) {
          return trigger.type === "condition"
            ? evaluateCondition(root, trigger)
            : evaluateCustom(root, trigger, event);
        });
        if (matched && !active) {
          active = true;
          play(root);
        } else if (!matched) {
          active = false;
        }
      }
      check();
      window.setInterval(check, 150);
    })(roots[index]);
  }
})();
</script>`;

function inlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

export interface RenderOptions {
  preview?: boolean;
}

function renderAnimationGroups(
  content: string,
  groups: ReturnType<typeof animationGroupsOf>,
  targetId: string,
  keyframeCss: string[],
): string {
  let result = content;
  for (const group of groups) {
    if (!group.enabled) {
      continue;
    }
    if (!hasAnimations(group.animations) && !hasKeyframes(group.keyframes)) {
      continue;
    }
    const paused = group.triggers.length > 0;
    const groupKey = `${targetId}-${group.id}`;
    const keyframe = buildKeyframeAnimation(group.keyframes, groupKey, {
      paused,
      group: group.id,
    });
    if (keyframe.css) {
      keyframeCss.push(keyframe.css);
    }
    let html = keyframe.wrap(result);
    html = wrapAnimatedHtml(html, group.animations, {
      paused,
      group: group.id,
    });
    if (paused) {
      html = `<div class="spark-anim-trigger-root" data-spark-anim-group="${htmlAttr(group.id)}" data-spark-anim-triggers="${htmlAttr(JSON.stringify(group.triggers))}">${html}</div>`;
    }
    result = html;
  }
  return result;
}

export function renderPageHtml(
  page: Page,
  project: Project,
  options: RenderOptions = {},
): string {
  const theme = project.theme;
  const keyframeCss: string[] = [];
  const modules = page.modules
    .map((module, index) => {
      const definition = getModuleDefinitionSafe(module.type);
      const content = definition.renderHtml(module, {
        theme,
        preview: true,
      });
      const triggerContent = renderAnimationGroups(
        content,
        animationGroupsOf(module),
        `module-${module.id}`,
        keyframeCss,
      );
      const rect = rectOf(module, page.width, page.height);
      return `<div id="${htmlAttr(module.id)}" class="spark-module" data-spark-module-id="${htmlAttr(module.id)}" data-spark-module-type="${htmlAttr(module.type)}" style="position:absolute;left:${rect.x}px;top:${rect.y}px;width:${module.width}px;height:${module.height}px;z-index:${index + 1};">${triggerContent}</div>`;
    })
    .join("\n");

  const customScript = page.customScript?.trim()
    ? `<script${page.scriptLanguage === "typescript" ? ' type="text/typescript"' : ""}>${inlineScript(page.customScript)}</script>`
    : "";
  const pageHtml = `<div class="spark-page">${modules}</div>`;
  const triggerPage = renderAnimationGroups(
    pageHtml,
    animationGroupsOf(page),
    `page-${page.id}`,
    keyframeCss,
  );
  const hasTriggers = Boolean(
    animationGroupsOf(page).some((group) => group.triggers.length > 0) ||
      page.modules.some((module) =>
        animationGroupsOf(module).some((group) => group.triggers.length > 0),
      ),
  );
  const triggerScript = hasTriggers ? ANIMATION_TRIGGER_SCRIPT : "";
  const previewBridge = options.preview ? PREVIEW_BRIDGE : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${page.width}px;
    height: ${page.height}px;
    overflow: hidden;
    background: ${htmlAttr(page.background)};
    font-family: ${htmlAttr(theme.fontFamily)};
    color: ${htmlAttr(theme.text)};
    -webkit-font-smoothing: antialiased;
  }
  .spark-page {
    position: relative;
    width: ${page.width}px;
    height: ${page.height}px;
    overflow: hidden;
    background: ${htmlAttr(page.background)};
    --spark-primary: ${htmlAttr(theme.primary)};
    --spark-text: ${htmlAttr(theme.text)};
    --spark-muted: ${htmlAttr(theme.muted)};
    --spark-surface: ${htmlAttr(theme.surface)};
  }
  .spark-module { box-sizing: border-box; }
  .spark-kf-layer { width: 100%; height: 100%; position: relative; }
  ${ANIMATION_CSS}
  ${keyframeCss.join("\n")}
  .spark-wand-hover { outline: 2px solid #6750a4 !important; outline-offset: -2px !important; cursor: crosshair !important; }
  .spark-wand-selected { outline: 2px solid #6750a4 !important; outline-offset: -2px !important; }
  a { color: inherit; }
  input, button, textarea, select { font-family: inherit; }
</style>
</head>
<body>
${triggerPage}
${triggerScript}
${customScript}
${previewBridge}
</body>
</html>`;
}


