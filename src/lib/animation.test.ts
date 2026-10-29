import { describe, expect, it } from "vitest";
import { animationStyle, wrapAnimatedHtml } from "./animation";
import type { AnimationConfig } from "../model/types";

const config: AnimationConfig = {
  entrance: "fade-in",
  loop: "float",
  exit: "fade-out",
  duration: 500,
  delay: 100,
  exitDelay: 2000,
  easing: "ease-out",
};

describe("animation helpers", () => {
  it("builds entrance, loop and exit timings", () => {
    expect(animationStyle(config, "entrance")).toContain(
      "spark-entrance-fade-in 500ms ease-out 100ms 1 both",
    );
    expect(animationStyle(config, "loop")).toContain(
      "spark-loop-float 500ms ease-out 600ms infinite none",
    );
    expect(animationStyle(config, "exit")).toContain(
      "spark-exit-fade-out 500ms ease-out 2600ms 1 both",
    );
  });

  it("wraps content in three isolated layers", () => {
    const html = wrapAnimatedHtml("<div>content</div>", config);
    expect(html.match(/spark-anim-layer/g)).toHaveLength(3);
    expect(html).toContain("spark-entrance-fade-in");
    expect(html).toContain("spark-loop-float");
    expect(html).toContain("spark-exit-fade-out");
  });

  it("does not wrap content without animations", () => {
    expect(wrapAnimatedHtml("<div>content</div>", undefined)).toBe(
      "<div>content</div>",
    );
  });

  it("falls back to a safe easing value", () => {
    const style = animationStyle(
      { ...config, easing: "ease;background:url(evil)" },
      "entrance",
    );
    expect(style).not.toContain("evil");
  });
});
