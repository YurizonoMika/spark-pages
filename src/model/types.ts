export type PropPrimitive = string | number | boolean | null;

export type PropValue = PropPrimitive | PropValue[] | { [key: string]: PropValue };

export interface AnimationConfig {
  entrance: string;
  loop: string;
  exit: string;
  duration: number;
  delay: number;
  exitDelay: number;
  easing: string;
}

export type AnimationTriggerType =
  | "auto"
  | "click"
  | "hover"
  | "condition"
  | "custom";

export type AnimationValueSource = "value" | "text" | "attribute";
export type AnimationCompareOperator = "gt" | "eq" | "lt";

export interface AnimationTrigger {
  type: AnimationTriggerType;
  moduleId?: string;
  property?: AnimationValueSource;
  attribute?: string;
  operator?: AnimationCompareOperator;
  value?: string;
  code?: string;
}

export interface AnimationGroup {
  id: string;
  name: string;
  enabled: boolean;
  animations?: AnimationConfig;
  keyframes?: KeyframeAnimation;
  triggers: AnimationTrigger[];
}

export type KeyframeProperty = string;
export type AnchorX = "left" | "right";
export type AnchorY = "top" | "bottom";

export interface Keyframe {
  id: string;
  time: number;
  value: number;
  easing: string;
}

export interface KeyframeAnimation {
  duration: number;
  loop: boolean;
  tracks: Record<string, Keyframe[]>;
}

export interface ModuleNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, PropValue>;
  anchorX?: AnchorX;
  anchorY?: AnchorY;
  animations?: AnimationConfig;
  keyframes?: KeyframeAnimation;
  animationTrigger?: AnimationTrigger;
  animationGroups?: AnimationGroup[];
}

export interface Page {
  id: string;
  title: string;
  width: number;
  height: number;
  grid: number;
  background: string;
  modules: ModuleNode[];
  customScript?: string;
  scriptLanguage?: "javascript" | "typescript";
  animations?: AnimationConfig;
  keyframes?: KeyframeAnimation;
  animationTrigger?: AnimationTrigger;
  animationGroups?: AnimationGroup[];
}

export interface Theme {
  fontFamily: string;
  primary: string;
  text: string;
  muted: string;
  surface: string;
}

export type ProjectType = "html" | "vue";
export type ProjectTemplate = "static" | "vite-vue-ts";

export interface Project {
  version: 1;
  name: string;
  description: string;
  type: ProjectType;
  template: ProjectTemplate;
  theme: Theme;
  pages: Page[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type DesignView = "canvas" | "script" | "preview";
export type FileView = "code" | "preview" | "script";
export type LeftTab = "ai" | "files" | "modules" | "layers" | "pages";
export type CodeLanguage =
  | "html"
  | "javascript"
  | "typescript"
  | "css"
  | "json";
export type SettingsTab = "project" | "ai";
export type AnimationTab = "keyframes" | "presets" | "trigger";
