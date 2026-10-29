import type {
  Keyframe,
  KeyframeAnimation,
  KeyframeProperty,
} from "./types";

export interface KeyframePropertyDefinition {
  key: KeyframeProperty;
  label: string;
  unit: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

export const ANIMATABLE_PROPERTIES: KeyframePropertyDefinition[] = [
  { key: "x", label: "X 位移", unit: "px", defaultValue: 0, min: -4000, max: 4000, step: 1 },
  { key: "y", label: "Y 位移", unit: "px", defaultValue: 0, min: -4000, max: 4000, step: 1 },
  { key: "scale", label: "缩放", unit: "×", defaultValue: 1, min: 0.05, max: 5, step: 0.01 },
  { key: "rotate", label: "旋转", unit: "°", defaultValue: 0, min: -1440, max: 1440, step: 1 },
  { key: "skewX", label: "倾斜 X", unit: "°", defaultValue: 0, min: -180, max: 180, step: 1 },
  { key: "skewY", label: "倾斜 Y", unit: "°", defaultValue: 0, min: -180, max: 180, step: 1 },
  { key: "opacity", label: "不透明度", unit: "", defaultValue: 1, min: 0, max: 1, step: 0.01 },
  { key: "blur", label: "模糊", unit: "px", defaultValue: 0, min: 0, max: 80, step: 0.5 },
  { key: "brightness", label: "亮度", unit: "×", defaultValue: 1, min: 0, max: 3, step: 0.05 },
  { key: "saturate", label: "饱和度", unit: "×", defaultValue: 1, min: 0, max: 3, step: 0.05 },
];

// Backwards-compatible alias for code that still references the old name.
export const KEYFRAME_PROPERTIES = ANIMATABLE_PROPERTIES;

export const DEFAULT_KEYFRAME_ANIMATION: KeyframeAnimation = {
  duration: 3000,
  loop: true,
  tracks: {},
};

export function keyframePropertyDefinition(
  property: KeyframeProperty,
): KeyframePropertyDefinition {
  return (
    ANIMATABLE_PROPERTIES.find((item) => item.key === property) ?? {
      key: property,
      label: property,
      unit: "",
      defaultValue: 0,
      min: -100000,
      max: 100000,
      step: 1,
    }
  );
}

export function normalizeKeyframeAnimation(
  patch: Partial<KeyframeAnimation> = {},
): KeyframeAnimation {
  const duration =
    typeof patch.duration === "number" && Number.isFinite(patch.duration)
      ? Math.max(100, Math.round(patch.duration))
      : DEFAULT_KEYFRAME_ANIMATION.duration;
  const tracks: KeyframeAnimation["tracks"] = {};
  for (const [property, track] of Object.entries(patch.tracks ?? {})) {
    if (!Array.isArray(track)) {
      continue;
    }
    tracks[property] = track
      .filter(
        (keyframe) =>
          Number.isFinite(keyframe.time) && Number.isFinite(keyframe.value),
      )
      .map((keyframe) => ({
        id: keyframe.id,
        time: Math.min(duration, Math.max(0, Math.round(keyframe.time))),
        value: keyframe.value,
        easing: keyframe.easing || "cubic-bezier(0.2, 0, 0, 1)",
      }))
      .sort((a, b) => a.time - b.time);
  }
  return {
    duration,
    loop:
      typeof patch.loop === "boolean"
        ? patch.loop
        : DEFAULT_KEYFRAME_ANIMATION.loop,
    tracks,
  };
}

export function hasKeyframes(
  config?: KeyframeAnimation | null,
): boolean {
  if (!config) {
    return false;
  }
  return Object.values(config.tracks).some((track) => track.length > 0);
}

function applyEasing(progress: number, easing: string): number {
  const t = Math.min(1, Math.max(0, progress));
  if (easing === "ease-in") {
    return t * t;
  }
  if (easing === "ease-out") {
    return 1 - (1 - t) * (1 - t);
  }
  if (easing === "ease-in-out") {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  if (easing === "cubic-bezier(0.34, 1.56, 0.64, 1)") {
    const c = 1.70158;
    const p = t - 1;
    return 1 + (c + 1) * p * p * p + c * p * p;
  }
  if (easing === "linear") {
    return t;
  }
  return t * t * (3 - 2 * t);
}

export function valueAtTime(
  track: Keyframe[] | undefined,
  time: number,
  fallback: number,
): number {
  if (!track || track.length === 0) {
    return fallback;
  }
  const sorted = [...track].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (time <= first.time) {
    return first.value;
  }
  if (time >= last.time) {
    return last.value;
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (time >= current.time && time <= next.time) {
      const span = Math.max(next.time - current.time, 1);
      const progress = applyEasing((time - current.time) / span, current.easing);
      return current.value + (next.value - current.value) * progress;
    }
  }
  return last.value;
}

export function sampleKeyframes(
  config: KeyframeAnimation | undefined,
  time: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const property of ANIMATABLE_PROPERTIES) {
    result[property.key] = valueAtTime(
      config?.tracks[property.key],
      time,
      property.defaultValue,
    );
  }
  for (const [property, track] of Object.entries(config?.tracks ?? {})) {
    if (!(property in result)) {
      result[property] = valueAtTime(track, time, 0);
    }
  }
  return result;
}

export function keyframePreviewStyle(
  config: KeyframeAnimation | undefined,
  time: number,
): { transform?: string; opacity?: number; filter?: string } | null {
  if (!config || !hasKeyframes(config)) {
    return null;
  }
  const value = sampleKeyframes(config, time);
  const hasTransform = ["x", "y", "rotate", "skewX", "skewY", "scale"].some(
    (property) => (config.tracks[property]?.length ?? 0) > 0,
  );
  const hasOpacity = (config.tracks.opacity?.length ?? 0) > 0;
  const hasFilter = ["blur", "brightness", "saturate"].some(
    (property) => (config.tracks[property]?.length ?? 0) > 0,
  );
  const style: { transform?: string; opacity?: number; filter?: string } = {};
  if (hasTransform) {
    style.transform = `translate(${value.x}px, ${value.y}px) rotate(${value.rotate}deg) skew(${value.skewX}deg, ${value.skewY}deg) scale(${value.scale})`;
  }
  if (hasOpacity) {
    style.opacity = value.opacity;
  }
  if (hasFilter) {
    style.filter = `blur(${value.blur}px) brightness(${value.brightness}) saturate(${value.saturate})`;
  }
  return style;
}

export function formatKeyframeValue(
  property: KeyframeProperty,
  value: number,
): string {
  if (
    property === "opacity" ||
    property === "scale" ||
    property === "brightness" ||
    property === "saturate"
  ) {
    return value.toFixed(2);
  }
  return `${Math.round(value)}${keyframePropertyDefinition(property).unit}`;
}
