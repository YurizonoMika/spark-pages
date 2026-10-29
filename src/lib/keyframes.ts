import { EASING_OPTIONS } from "../model/animations";
import { htmlAttr } from "./escape";
import {
  ANIMATABLE_PROPERTIES,
  keyframePropertyDefinition,
} from "../model/keyframes";
import type {
  Keyframe,
  KeyframeAnimation,
  KeyframeProperty,
} from "../model/types";

const FALLBACK_EASING = "cubic-bezier(0.2, 0, 0, 1)";

function safeEasing(easing: string): string {
  return EASING_OPTIONS.some((option) => option.value === easing)
    ? easing
    : FALLBACK_EASING;
}

function safeTargetId(targetId: string): string {
  return targetId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function declaration(property: KeyframeProperty, value: number): string {
  if (property === "x") {
    return `transform:translateX(${value}px);`;
  }
  if (property === "y") {
    return `transform:translateY(${value}px);`;
  }
  if (property === "scale") {
    return `transform:scale(${value});`;
  }
  if (property === "rotate") {
    return `transform:rotate(${value}deg);`;
  }
  if (property === "skewX") {
    return `transform:skewX(${value}deg);`;
  }
  if (property === "skewY") {
    return `transform:skewY(${value}deg);`;
  }
  if (property === "blur") {
    return `filter:blur(${value}px);`;
  }
  if (property === "brightness") {
    return `filter:brightness(${value});`;
  }
  if (property === "saturate") {
    return `filter:saturate(${value});`;
  }
  return `opacity:${value};`;
}

function buildTrackRule(
  name: string,
  property: KeyframeProperty,
  track: Keyframe[],
  duration: number,
): string {
  const sorted = [...track].sort((a, b) => a.time - b.time);
  const stops = new Map<number, { value: number; easing: string }>();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.time > 0) {
    stops.set(0, { value: first.value, easing: "linear" });
  }
  for (const keyframe of sorted) {
    stops.set(keyframe.time, {
      value: keyframe.value,
      easing: safeEasing(keyframe.easing),
    });
  }
  if (last.time < duration) {
    stops.set(duration, { value: last.value, easing: "linear" });
  }

  const key = property;
  const lines = Array.from(stops.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, stop]) => {
      const percent = Math.min(100, Math.max(0, (time / duration) * 100));
      return `  ${percent.toFixed(3)}% { ${declaration(key, stop.value)} animation-timing-function:${stop.easing}; }`;
    });
  return `@keyframes ${name} {\n${lines.join("\n")}\n}`;
}

export interface BuiltKeyframeAnimation {
  css: string;
  wrap: (html: string) => string;
}

export function buildKeyframeAnimation(
  config: KeyframeAnimation | undefined,
  targetId: string,
): BuiltKeyframeAnimation {
  const cssRules: string[] = [];
  const wrappers = new Map<KeyframeProperty, string>();
  const cleanId = safeTargetId(targetId);
  const duration = Math.max(config?.duration ?? 3000, 100);
  const loop = config?.loop ?? false;

  if (config) {
    for (const [property, track] of Object.entries(config.tracks)) {
      if (
        !track ||
        track.length === 0 ||
        !ANIMATABLE_PROPERTIES.some((item) => item.key === property)
      ) {
        continue;
      }
      const name = `spark-kf-${cleanId}-${safeTargetId(property)}`;
      cssRules.push(buildTrackRule(name, property, track, duration));
      wrappers.set(
        property,
        `animation:${name} ${duration}ms linear 0ms ${loop ? "infinite" : "1"} both;`,
      );
    }
  }

  const wrap = (html: string): string => {
    let result = html;
    const order: KeyframeProperty[] = [
      "opacity",
      "saturate",
      "brightness",
      "blur",
      "scale",
      "skewY",
      "skewX",
      "rotate",
      "y",
      "x",
    ];
    for (const property of order) {
      const style = wrappers.get(property);
      if (style) {
        result = `<div class="spark-kf-layer" style="${htmlAttr(style)}">${result}</div>`;
      }
    }
    return result;
  };

  return { css: cssRules.join("\n"), wrap };
}

export function keyframeTrackLabel(property: KeyframeProperty): string {
  return keyframePropertyDefinition(property).label;
}
