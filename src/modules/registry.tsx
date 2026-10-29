import type { ModuleDefinition, ModuleIcon } from "./types";

const definitions = new Map<string, ModuleDefinition>();

export const CATEGORY_ORDER = ["文本", "媒体", "交互", "布局"];

export function registerModule(definition: ModuleDefinition): void {
  definitions.set(definition.type, definition);
}

export function registerModules(list: ModuleDefinition[]): void {
  for (const definition of list) {
    registerModule(definition);
  }
}

export function unregisterPluginModules(pluginId: string): void {
  for (const [type, definition] of definitions) {
    if (definition.pluginId === pluginId) {
      definitions.delete(type);
    }
  }
}

export function getModuleDefinition(type: string): ModuleDefinition | undefined {
  return definitions.get(type);
}

export function listModuleDefinitions(): ModuleDefinition[] {
  return Array.from(definitions.values()).sort((a, b) => {
    const categoryDelta =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return a.label.localeCompare(b.label, "zh-CN");
  });
}

export function groupModuleDefinitions(): Array<{
  category: string;
  modules: ModuleDefinition[];
}> {
  const groups = new Map<string, ModuleDefinition[]>();
  for (const definition of listModuleDefinitions()) {
    const group = groups.get(definition.category) ?? [];
    group.push(definition);
    groups.set(definition.category, group);
  }
  return Array.from(groups.entries()).map(([category, modules]) => ({
    category,
    modules,
  }));
}

const FallbackIcon: ModuleIcon = ({ size = 16, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 16 9 5 9-5" />
  </svg>
);

export function getModuleDefinitionSafe(type: string): ModuleDefinition {
  return (
    definitions.get(type) ?? {
      type,
      label: type,
      category: "其他",
      description: "模块未安装或类型未知",
      icon: FallbackIcon,
      defaultSize: { width: 320, height: 96 },
      defaultProps: {},
      fields: [],
      render: () => null,
      renderHtml: () => "",
      ai: {
        description: "未知模块类型，无法渲染。",
      },
    }
  );
}
