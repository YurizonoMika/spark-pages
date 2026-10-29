import { describe, expect, it } from "vitest";
import { buildKeyframeAnimation } from "./keyframes";
import {
  keyframePreviewStyle,
  sampleKeyframes,
  valueAtTime,
} from "../model/keyframes";
import type { KeyframeAnimation } from "../model/types";

const config: KeyframeAnimation = {
  duration: 1000,
  loop: false,
  tracks: {
    x: [
      { id: "a", time: 0, value: 0, easing: "linear" },
      { id: "b", time: 1000, value: 100, easing: "linear" },
    ],
    opacity: [
      { id: "c", time: 0, value: 1, easing: "linear" },
      { id: "d", time: 1000, value: 0, easing: "linear" },
    ],
  },
};

describe("keyframe animation", () => {
  it("interpolates values at a given time", () => {
    expect(valueAtTime(config.tracks.x, 500, 0)).toBe(50);
    expect(valueAtTime(config.tracks.x, -1, 0)).toBe(0);
    expect(valueAtTime(config.tracks.x, 1500, 0)).toBe(100);
  });

  it("samples all properties", () => {
    const sample = sampleKeyframes(config, 250);
    expect(sample.x).toBe(25);
    expect(sample.scale).toBe(1);
    expect(sample.opacity).toBe(0.75);
  });

  it("builds a preview transform", () => {
    const style = keyframePreviewStyle(config, 1000);
    expect(style?.transform).toContain("translate(100px, 0px)");
    expect(style?.opacity).toBe(0);
  });

  it("builds CSS keyframes and wrappers", () => {
    const built = buildKeyframeAnimation(config, "module-test");
    expect(built.css).toContain("@keyframes spark-kf-module-test-x");
    expect(built.css).toContain("translateX(100px)");
    expect(built.wrap("<div>content</div>").match(/spark-kf-layer/g)).toHaveLength(
      2,
    );
  });

  it("returns an identity wrapper without tracks", () => {
    const built = buildKeyframeAnimation(
      { duration: 1000, loop: false, tracks: {} },
      "empty",
    );
    expect(built.css).toBe("");
    expect(built.wrap("<div />")).toBe("<div />");
  });
});
