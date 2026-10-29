export const MODULE_DRAG_TYPE = "application/x-spark-module";

let draggingModuleType: string | null = null;

export function setDraggingModuleType(type: string | null): void {
  draggingModuleType = type;
}

export function getDraggingModuleType(): string | null {
  return draggingModuleType;
}

export const SCRIPT_BLOCK_DRAG_TYPE = "application/x-spark-script-block";

let draggingScriptBlockKind: string | null = null;

export function setDraggingScriptBlockKind(kind: string | null): void {
  draggingScriptBlockKind = kind;
}

export function getDraggingScriptBlockKind(): string | null {
  return draggingScriptBlockKind;
}
