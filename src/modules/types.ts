import type { ComponentType, ReactNode } from "react";
import type { ModuleNode, PropValue, Theme } from "../model/types";

export type ModuleIcon = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}>;

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "color"
  | "boolean";

export type ModuleFieldGroup =
  | "content"
  | "typography"
  | "appearance"
  | "interaction";

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface ModuleField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  group?: ModuleFieldGroup;
}

export interface ModuleRenderContext {
  theme: Theme;
  preview: boolean;
}

export interface ModuleAiHints {
  description: string;
  usage?: string;
}

export interface ModuleDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: ModuleIcon;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  defaultProps: Record<string, PropValue>;
  fields: ModuleField[];
  render: (module: ModuleNode, context: ModuleRenderContext) => ReactNode;
  renderHtml: (module: ModuleNode, context: ModuleRenderContext) => string;
  ai?: ModuleAiHints;
  pluginId?: string;
}

export function propString(
  module: ModuleNode,
  key: string,
  fallback = "",
): string {
  const value = module.props[key];
  return typeof value === "string" ? value : fallback;
}

export function propNumber(
  module: ModuleNode,
  key: string,
  fallback = 0,
): number {
  const value = module.props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function propBoolean(
  module: ModuleNode,
  key: string,
  fallback = false,
): boolean {
  const value = module.props[key];
  return typeof value === "boolean" ? value : fallback;
}
