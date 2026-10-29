import { createId } from "./defaults";
import { hasAnimationTrigger, normalizeTrigger } from "./animations";
import { hasKeyframes } from "./keyframes";
import type {
  AnimationGroup,
  AnimationTrigger,
  KeyframeAnimation,
  ModuleNode,
  Page,
  AnimationConfig,
} from "./types";

export type AnimationHost = Pick<
  ModuleNode,
  "animations" | "keyframes" | "animationTrigger" | "animationGroups"
> &
  Partial<Pick<Page, "animations" | "keyframes" | "animationTrigger" | "animationGroups">>;

export function newAnimationGroup(name = "动画"): AnimationGroup {
  return {
    id: createId("anim"),
    name,
    enabled: true,
    triggers: [],
  };
}

export function hasGroupAnimation(
  group: Pick<AnimationGroup, "animations" | "keyframes">,
): boolean {
  return Boolean(
    (group.animations &&
      (group.animations.entrance ||
        group.animations.loop ||
        group.animations.exit)) ||
      hasKeyframes(group.keyframes),
  );
}

export function normalizeAnimationGroup(
  group: AnimationGroup,
): AnimationGroup {
  return {
    id: group.id || createId("anim"),
    name: group.name?.trim() || "动画",
    enabled: group.enabled !== false,
    ...(group.animations ? { animations: group.animations } : {}),
    ...(group.keyframes
      ? { keyframes: normalizeKeyframe(group.keyframes) }
      : {}),
    triggers: (group.triggers ?? [])
      .map((trigger) => normalizeTrigger(trigger))
      .filter(hasAnimationTrigger),
  };
}

function normalizeKeyframe(config: KeyframeAnimation): KeyframeAnimation {
  return {
    ...config,
    tracks: config.tracks ?? {},
    duration: Math.max(100, Math.round(config.duration || 3000)),
    loop: Boolean(config.loop),
  };
}

/**
 * Existing documents store one preset animation, one keyframe timeline and one
 * trigger directly on the page/module. Present them as a single group so the
 * animation panel and renderer can treat every animation the same way.
 */
export function animationGroupsOf(host: AnimationHost): AnimationGroup[] {
  if (host.animationGroups && host.animationGroups.length > 0) {
    return host.animationGroups.map((group) => ({
      ...group,
      triggers: group.triggers ?? [],
    }));
  }
  const hasLegacyAnimation =
    host.animations &&
    (host.animations.entrance || host.animations.loop || host.animations.exit);
  const trigger = host.animationTrigger;
  if (!hasLegacyAnimation && !hasKeyframes(host.keyframes) && !trigger) {
    return [];
  }
  return [
    {
      id: "legacy",
      name: "默认动画",
      enabled: true,
      ...(hasLegacyAnimation ? { animations: host.animations } : {}),
      ...(hasKeyframes(host.keyframes)
        ? { keyframes: host.keyframes }
        : {}),
      triggers: trigger ? [normalizeTrigger(trigger)] : [],
    },
  ];
}

export function materializeAnimationGroups(
  host: AnimationHost,
): AnimationGroup[] {
  if (host.animationGroups && host.animationGroups.length > 0) {
    return host.animationGroups;
  }
  host.animationGroups = animationGroupsOf(host);
  delete host.animations;
  delete host.keyframes;
  delete host.animationTrigger;
  return host.animationGroups;
}

export function ensureAnimationGroups(host: AnimationHost): AnimationGroup[] {
  const groups = materializeAnimationGroups(host);
  if (groups.length === 0) {
    groups.push(newAnimationGroup("动画 1"));
  }
  return groups;
}

export function firstAnimationGroup(
  host: AnimationHost,
): AnimationGroup | undefined {
  return animationGroupsOf(host)[0];
}

export function animationGroupById(
  host: AnimationHost,
  groupId?: string | null,
): AnimationGroup | undefined {
  const groups = animationGroupsOf(host);
  if (!groupId) {
    return groups[0];
  }
  return groups.find((group) => group.id === groupId) ?? groups[0];
}

export type AnimationConfigPatch = Partial<AnimationConfig>;
export type AnimationTriggerList = AnimationTrigger[];
