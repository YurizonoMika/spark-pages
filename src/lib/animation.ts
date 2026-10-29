import {
  DEFAULT_ANIMATION,
  EASING_OPTIONS,
  hasAnimations,
  isKnownAnimation,
} from "../model/animations";
import type { AnimationConfig } from "../model/types";
import { htmlAttr } from "./escape";

export const ANIMATION_CSS = `
.spark-anim-layer { width: 100%; height: 100%; position: relative; }
.spark-anim-trigger-root { width: 100%; height: 100%; position: relative; }
@keyframes spark-entrance-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes spark-entrance-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spark-entrance-slide-down { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spark-entrance-slide-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes spark-entrance-slide-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes spark-entrance-zoom-in { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
@keyframes spark-entrance-rotate-in { from { opacity: 0; transform: rotate(-8deg) scale(.92); } to { opacity: 1; transform: rotate(0) scale(1); } }
@keyframes spark-entrance-bounce-in { 0% { opacity: 0; transform: scale(.6); } 60% { opacity: 1; transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes spark-entrance-blur-in { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
@keyframes spark-loop-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes spark-loop-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes spark-loop-sway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
@keyframes spark-loop-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes spark-loop-breathe { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes spark-exit-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes spark-exit-slide-up-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-24px); } }
@keyframes spark-exit-slide-down-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(24px); } }
@keyframes spark-exit-slide-left-out { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-24px); } }
@keyframes spark-exit-slide-right-out { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(24px); } }
@keyframes spark-exit-zoom-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.82); } }
@keyframes spark-exit-rotate-out { from { opacity: 1; transform: rotate(0) scale(1); } to { opacity: 0; transform: rotate(8deg) scale(.92); } }
@keyframes spark-exit-blur-out { from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(10px); } }
`;

function delayFor(
  config: AnimationConfig,
  kind: "entrance" | "loop" | "exit",
): number {
  let delay = config.delay;
  if (config.entrance && kind !== "entrance") {
    delay += config.duration;
  }
  if (kind === "exit") {
    delay += config.exitDelay;
  }
  return delay;
}

export function animationStyle(
  config: AnimationConfig,
  kind: "entrance" | "loop" | "exit",
): string {
  const value = config[kind];
  if (!value || !isKnownAnimation(kind, value)) {
    return "";
  }
  const name = `spark-${kind}-${value}`;
  const iteration = kind === "loop" ? "infinite" : "1";
  const fill = kind === "loop" ? "none" : "both";
  const easing = EASING_OPTIONS.some((option) => option.value === config.easing)
    ? config.easing
    : DEFAULT_ANIMATION.easing;
  return `animation:${name} ${config.duration}ms ${easing} ${delayFor(config, kind)}ms ${iteration} ${fill};`;
}

export interface WrapAnimationOptions {
  paused?: boolean;
}

export function wrapAnimatedHtml(
  html: string,
  config?: AnimationConfig | null,
  options: WrapAnimationOptions = {},
): string {
  if (!config || !hasAnimations(config)) {
    return html;
  }
  const paused = Boolean(options.paused);
  const styles = [
    animationStyle(config, "exit"),
    animationStyle(config, "loop"),
    animationStyle(config, "entrance"),
  ].filter(Boolean);
  let result = html;
  for (const style of styles) {
    const attributes = paused
      ? ` data-spark-anim-style="${htmlAttr(style)}" style="${htmlAttr(`${style}animation-play-state:paused;`)}"`
      : ` style="${htmlAttr(style)}"`;
    result = `<div class="spark-anim-layer"${attributes}>${result}</div>`;
  }
  return result;
}
