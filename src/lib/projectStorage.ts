import { z } from "zod";
import type { Project, PropValue } from "../model/types";

const DRAFT_KEY = "spark-pages:draft:v1";

const propValueSchema: z.ZodType<PropValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(propValueSchema),
    z.record(z.string(), propValueSchema),
  ]),
);

const animationSchema = z.object({
  entrance: z.string().default(""),
  loop: z.string().default(""),
  exit: z.string().default(""),
  duration: z.number().default(700),
  delay: z.number().default(0),
  exitDelay: z.number().default(3000),
  easing: z.string().default("cubic-bezier(0.2, 0, 0, 1)"),
});

const keyframeSchema = z.object({
  id: z.string().min(1),
  time: z.number(),
  value: z.number(),
  easing: z.string(),
});

const keyframeAnimationSchema = z.object({
  duration: z.number().default(3000),
  loop: z.boolean().default(true),
  tracks: z.record(z.string(), z.array(keyframeSchema)).default({}),
});

const animationTriggerSchema = z.object({
  type: z.enum(["auto", "click", "hover", "condition", "custom"]),
  moduleId: z.string().optional(),
  property: z.enum(["value", "text", "attribute"]).optional(),
  attribute: z.string().optional(),
  operator: z.enum(["gt", "eq", "lt"]).optional(),
  value: z.string().optional(),
  code: z.string().optional(),
});

const animationGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().default("动画"),
  enabled: z.boolean().default(true),
  animations: animationSchema.optional(),
  keyframes: keyframeAnimationSchema.optional(),
  triggers: z.array(animationTriggerSchema).default([]),
});

const moduleSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  props: z.record(z.string(), propValueSchema),
  anchorX: z.enum(["left", "right"]).optional(),
  anchorY: z.enum(["top", "bottom"]).optional(),
  animations: animationSchema.optional(),
  keyframes: keyframeAnimationSchema.optional(),
  animationTrigger: animationTriggerSchema.optional(),
  animationGroups: z.array(animationGroupSchema).optional(),
});

const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  grid: z.number().positive(),
  background: z.string(),
  modules: z.array(moduleSchema),
  customScript: z.string().optional(),
  scriptLanguage: z.enum(["javascript", "typescript"]).optional(),
  file: z.string().optional(),
  animations: animationSchema.optional(),
  keyframes: keyframeAnimationSchema.optional(),
  animationTrigger: animationTriggerSchema.optional(),
  animationGroups: z.array(animationGroupSchema).optional(),
});

const themeSchema = z.object({
  fontFamily: z.string(),
  primary: z.string(),
  text: z.string(),
  muted: z.string(),
  surface: z.string(),
});

export const projectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().default("未命名项目"),
    description: z.string().default(""),
    type: z.preprocess(
      (value) => (value === "nodejs" ? "vue" : value),
      z.enum(["html", "vue"]).default("html"),
    ),
    // Kept optional so drafts from before the HTML/Vue project split load.
    template: z.string().optional(),
    theme: themeSchema,
    pages: z.array(pageSchema).min(1),
  })
  .transform((project) => ({
    ...project,
    template:
      project.type === "vue"
        ? ("vite-vue-ts" as const)
        : ("static" as const),
  }));

const draftSchema = z.object({
  project: projectSchema,
  activePageId: z.string().optional(),
  projectFolder: z.string().optional(),
  projectPath: z.string().optional(),
  savedAt: z.string().optional(),
});

export interface StoredDraft {
  project: Project;
  activePageId: string;
  projectFolder?: string;
  projectPath?: string;
}

export function saveDraft(
  project: Project,
  activePageId: string,
  projectFolder?: string | null,
  projectPath?: string | null,
): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        project,
        activePageId,
        projectFolder: projectFolder || undefined,
        projectPath: projectPath || undefined,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Autosave is best effort.
  }
}

export function loadDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    const project = parsed.data.project as Project;
    const activePageId =
      parsed.data.activePageId &&
      project.pages.some((page) => page.id === parsed.data.activePageId)
        ? parsed.data.activePageId
        : project.pages[0].id;
    return {
      project,
      activePageId,
      projectFolder: parsed.data.projectFolder,
      projectPath: parsed.data.projectPath,
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
