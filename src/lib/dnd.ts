export const MODULE_DRAG_TYPE = "application/x-spark-module";

let draggingModuleType: string | null = null;

export function setDraggingModuleType(type: string | null): void {
  draggingModuleType = type;
}

export function getDraggingModuleType(): string | null {
  return draggingModuleType;
}
