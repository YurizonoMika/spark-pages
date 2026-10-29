import type {
  AnimationCompareOperator,
  AnimationConfig,
  AnimationTrigger,
  AnimationTriggerType,
  AnimationValueSource,
} from "./types";

export interface AnimationOption {
  label: string;
  value: string;
}

export const DEFAULT_ANIMATION: AnimationConfig = {
  entrance: "",
  loop: "",
  exit: "",
  duration: 700,
  delay: 0,
  exitDelay: 3000,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
};

export const ENTRANCE_ANIMATIONS: AnimationOption[] = [
  { label: "无", value: "" },
  { label: "淡入", value: "fade-in" },
  { label: "上滑进入", value: "slide-up" },
  { label: "下滑进入", value: "slide-down" },
  { label: "左滑进入", value: "slide-left" },
  { label: "右滑进入", value: "slide-right" },
  { label: "缩放进入", value: "zoom-in" },
  { label: "旋转进入", value: "rotate-in" },
  { label: "弹入", value: "bounce-in" },
  { label: "模糊进入", value: "blur-in" },
];

export const LOOP_ANIMATIONS: AnimationOption[] = [
  { label: "无", value: "" },
  { label: "呼吸", value: "pulse" },
  { label: "漂浮", value: "float" },
  { label: "摇摆", value: "sway" },
  { label: "旋转", value: "spin" },
  { label: "渐隐渐现", value: "breathe" },
];

export const EXIT_ANIMATIONS: AnimationOption[] = [
  { label: "无", value: "" },
  { label: "淡出", value: "fade-out" },
  { label: "上滑退出", value: "slide-up-out" },
  { label: "下滑退出", value: "slide-down-out" },
  { label: "左滑退出", value: "slide-left-out" },
  { label: "右滑退出", value: "slide-right-out" },
  { label: "缩放退出", value: "zoom-out" },
  { label: "旋转退出", value: "rotate-out" },
  { label: "模糊退出", value: "blur-out" },
];

export const EASING_OPTIONS: AnimationOption[] = [
  { label: "标准", value: "cubic-bezier(0.2, 0, 0, 1)" },
  { label: "线性", value: "linear" },
  { label: "缓入", value: "ease-in" },
  { label: "缓出", value: "ease-out" },
  { label: "缓入缓出", value: "ease-in-out" },
  { label: "弹性", value: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
];

export const DEFAULT_TRIGGER: AnimationTrigger = { type: "auto" };

const TRIGGER_TYPES: AnimationTriggerType[] = [
  "auto",
  "click",
  "hover",
  "condition",
  "custom",
];
const VALUE_SOURCES: AnimationValueSource[] = ["value", "text", "attribute"];
const OPERATORS: AnimationCompareOperator[] = ["gt", "eq", "lt"];

export function normalizeTrigger(
  trigger?: Partial<AnimationTrigger> | null,
): AnimationTrigger {
  const type =
    trigger && TRIGGER_TYPES.includes(trigger.type as AnimationTriggerType)
      ? (trigger.type as AnimationTriggerType)
      : "auto";
  if (type === "auto") {
    return { type: "auto" };
  }
  const next: AnimationTrigger = { type };
  if (type === "condition") {
    if (typeof trigger?.moduleId === "string" && trigger.moduleId) {
      next.moduleId = trigger.moduleId;
    }
    next.property = VALUE_SOURCES.includes(
      trigger?.property as AnimationValueSource,
    )
      ? (trigger?.property as AnimationValueSource)
      : "value";
    next.operator = OPERATORS.includes(
      trigger?.operator as AnimationCompareOperator,
    )
      ? (trigger?.operator as AnimationCompareOperator)
      : "gt";
    next.value = typeof trigger?.value === "string" ? trigger.value : "";
    if (next.property === "attribute") {
      next.attribute =
        typeof trigger?.attribute === "string" && trigger.attribute.trim()
          ? trigger.attribute.trim()
          : "data-spark-value";
    }
  }
  if (type === "custom") {
    next.code =
      typeof trigger?.code === "string" ? trigger.code : "return false;";
  }
  return next;
}

export function hasAnimationTrigger(
  trigger?: AnimationTrigger | null,
): boolean {
  return Boolean(trigger && trigger.type !== "auto");
}

export function normalizeAnimation(
  patch: Partial<AnimationConfig> = {},
): AnimationConfig {
  return {
    entrance:
      typeof patch.entrance === "string"
        ? patch.entrance
        : DEFAULT_ANIMATION.entrance,
    loop: typeof patch.loop === "string" ? patch.loop : DEFAULT_ANIMATION.loop,
    exit: typeof patch.exit === "string" ? patch.exit : DEFAULT_ANIMATION.exit,
    duration:
      typeof patch.duration === "number" && Number.isFinite(patch.duration)
        ? Math.max(100, Math.round(patch.duration))
        : DEFAULT_ANIMATION.duration,
    delay:
      typeof patch.delay === "number" && Number.isFinite(patch.delay)
        ? Math.max(0, Math.round(patch.delay))
        : DEFAULT_ANIMATION.delay,
    exitDelay:
      typeof patch.exitDelay === "number" && Number.isFinite(patch.exitDelay)
        ? Math.max(0, Math.round(patch.exitDelay))
        : DEFAULT_ANIMATION.exitDelay,
    easing:
      typeof patch.easing === "string" && patch.easing
        ? patch.easing
        : DEFAULT_ANIMATION.easing,
  };
}

export function hasAnimations(config?: AnimationConfig | null): boolean {
  return Boolean(config?.entrance || config?.loop || config?.exit);
}

export function isKnownAnimation(
  kind: "entrance" | "loop" | "exit",
  value: string,
): boolean {
  const options =
    kind === "entrance"
      ? ENTRANCE_ANIMATIONS
      : kind === "loop"
        ? LOOP_ANIMATIONS
        : EXIT_ANIMATIONS;
  return options.some((option) => option.value === value);
}
