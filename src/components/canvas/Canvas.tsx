import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import clsx from "clsx";
import {
  Code2,
  Crosshair,
  Grid2X2,
  Maximize2,
  Scan,
  Wand2,
} from "lucide-react";
import type {
  ModuleNode,
  Rect,
  ResizeHandle,
} from "../../model/types";
import {
  clamp,
  fitZoom,
  moduleBounds,
  pagePointFromClient,
  rectOf,
  rectToAnchored,
  resizeRect,
  snap,
} from "../../lib/geometry";
import {
  getDraggingModuleType,
  MODULE_DRAG_TYPE,
} from "../../lib/dnd";
import {
  getModuleDefinition,
  getModuleDefinitionSafe,
} from "../../modules/registry";
import { hasAnimations } from "../../model/animations";
import { keyframePreviewStyle } from "../../model/keyframes";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { toast } from "../../store/toastStore";
import { goToModuleCode } from "../../lib/scriptNavigation";

interface DropGhost extends Rect {
  type: string;
}

type DragSession =
  | {
      kind: "move";
      startClientX: number;
      startClientY: number;
      pageRect: DOMRect;
      zoom: number;
      grid: number;
      pageWidth: number;
      group: Rect;
      starts: Map<string, Rect>;
      moved: boolean;
    }
  | {
      kind: "resize";
      moduleId: string;
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      pageRect: DOMRect;
      zoom: number;
      grid: number;
      pageWidth: number;
      startRect: Rect;
      minWidth: number;
      minHeight: number;
      moved: boolean;
    };

const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function clampAnchoredModule(
  module: ModuleNode,
  page: { width: number; height: number },
): void {
  module.x = clamp(module.x, 0, Math.max(page.width - module.width, 0));
  module.y = Math.max(0, module.y);
  if (module.anchorY === "bottom") {
    module.y = clamp(
      module.y,
      0,
      Math.max(page.height - module.height, 0),
    );
  }
}

function growPageHeight(
  page: {
    width: number;
    height: number;
    grid: number;
    modules: ModuleNode[];
  },
): void {
  const bottom = page.modules.reduce((max, module) => {
    const rect = rectOf(module, page.width, page.height);
    return Math.max(max, rect.y + rect.height);
  }, 0);
  if (bottom > page.height) {
    page.height = Math.ceil(bottom / page.grid) * page.grid;
  }
}

export function Canvas() {
  const page = useEditorStore(selectActivePage);
  const zoom = useEditorStore((state) => state.zoom);
  const showGrid = useEditorStore((state) => state.showGrid);
  const selection = useEditorStore((state) => state.selection);
  const animationDockOpen = useEditorStore(
    (state) => state.animationDockOpen,
  );
  const animationTime = useEditorStore((state) => state.animationTime);
  const theme = useEditorStore((state) => state.project.theme);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setSelection = useEditorStore((state) => state.setSelection);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const addModuleAt = useEditorStore((state) => state.addModuleAt);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const autoFitRef = useRef(false);
  const onPointerMoveRef = useRef<(event: PointerEvent) => void>(() => {});
  const onPointerUpRef = useRef<() => void>(() => {});
  const [dropGhost, setDropGhost] = useState<DropGhost | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    moduleId: string;
    x: number;
    y: number;
  } | null>(null);

  const selectedSet = new Set(selection);
  const pageAnimationStyle = animationDockOpen
    ? keyframePreviewStyle(page.keyframes, animationTime)
    : null;
  const singleSelected =
    selection.length === 1
      ? page.modules.find((module) => module.id === selection[0])
      : undefined;

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const close = () => setContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const openModuleMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    module: ModuleNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!useEditorStore.getState().selection.includes(module.id)) {
      setSelection([module.id]);
    }
    const width = 200;
    const height = 48;
    setContextMenu({
      moduleId: module.id,
      x: Math.max(
        8,
        Math.min(event.clientX, window.innerWidth - width - 8),
      ),
      y: Math.max(
        8,
        Math.min(event.clientY, window.innerHeight - height - 8),
      ),
    });
  };

  const goToCode = (moduleId: string) => {
    const store = useEditorStore.getState();
    store.openPageTab(page.id);
    store.setDesignView("script");
    const result = goToModuleCode(page.id, moduleId);
    setContextMenu(null);
    if (!result.ok) {
      toast(result.error ?? "无法定位元素代码", "error");
      return;
    }
    toast(
      result.inserted
        ? "已在页面脚本中生成该元素的代码"
        : "已定位到该元素的页面脚本",
      result.inserted ? "success" : "info",
    );
  };

  const fitPage = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    setZoom(
      fitZoom(page.width, page.height, viewport.clientWidth, viewport.clientHeight),
    );
  }, [page.height, page.width, setZoom]);

  const previousDockOpenRef = useRef(animationDockOpen);

  useEffect(() => {
    if (previousDockOpenRef.current === animationDockOpen) {
      return;
    }
    previousDockOpenRef.current = animationDockOpen;
    const timer = window.setTimeout(fitPage, 90);
    return () => window.clearTimeout(timer);
  }, [animationDockOpen, fitPage]);

  useEffect(() => {
    if (autoFitRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      autoFitRef.current = true;
      fitPage();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [fitPage]);

  useEffect(() => {
    const clearGhost = () => setDropGhost(null);
    window.addEventListener("dragend", clearGhost);
    window.addEventListener("drop", clearGhost);
    return () => {
      window.removeEventListener("dragend", clearGhost);
      window.removeEventListener("drop", clearGhost);
    };
  }, []);

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMoveRef.current);
      window.removeEventListener("pointerup", onPointerUpRef.current);
      window.removeEventListener("pointercancel", onPointerUpRef.current);
      if (dragRef.current) {
        useEditorStore.getState().cancelTransaction();
        dragRef.current = null;
      }
    },
    [],
  );

  const computeDrop = useCallback(
    (clientX: number, clientY: number, type: string): DropGhost | null => {
      const pageElement = pageRef.current;
      if (!pageElement) {
        return null;
      }
      const definition = getModuleDefinitionSafe(type);
      const width = Math.max(
        page.grid,
        snap(definition.defaultSize.width, page.grid),
      );
      const height = Math.max(
        page.grid,
        snap(definition.defaultSize.height, page.grid),
      );
      const point = pagePointFromClient(
        clientX,
        clientY,
        pageElement.getBoundingClientRect(),
        zoom,
      );
      return {
        type,
        x: clamp(snap(point.x - width / 2, page.grid), 0, Math.max(page.width - width, 0)),
        y: Math.max(0, snap(point.y - height / 2, page.grid)),
        width,
        height,
      };
    },
    [page.grid, page.width, zoom],
  );

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (
      !event.dataTransfer.types.includes(MODULE_DRAG_TYPE) &&
      !getDraggingModuleType()
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const type =
      event.dataTransfer.getData(MODULE_DRAG_TYPE) || getDraggingModuleType();
    if (!type) {
      return;
    }
    setDropGhost(computeDrop(event.clientX, event.clientY, type));
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type =
      event.dataTransfer.getData(MODULE_DRAG_TYPE) || getDraggingModuleType();
    setDropGhost(null);
    if (!type) {
      return;
    }
    const ghost = computeDrop(event.clientX, event.clientY, type);
    if (ghost) {
      addModuleAt(type, ghost.x, ghost.y);
    }
  };

  const finishDrag = useCallback(() => {
    window.removeEventListener("pointermove", onPointerMoveRef.current);
    window.removeEventListener("pointerup", onPointerUpRef.current);
    window.removeEventListener("pointercancel", onPointerUpRef.current);
    if (dragRef.current?.moved) {
      useEditorStore.getState().endTransaction();
    } else if (dragRef.current) {
      useEditorStore.getState().cancelTransaction();
    }
    dragRef.current = null;
  }, []);

  const startWindowTracking = useCallback(() => {
    onPointerUpRef.current = () => finishDrag();
    window.addEventListener("pointermove", onPointerMoveRef.current);
    window.addEventListener("pointerup", onPointerUpRef.current);
    window.addEventListener("pointercancel", onPointerUpRef.current);
  }, [finishDrag]);

  const handleModulePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    module: ModuleNode,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleSelection(module.id);
      return;
    }

    let activeSelection = useEditorStore.getState().selection;
    if (!activeSelection.includes(module.id)) {
      setSelection([module.id]);
      activeSelection = [module.id];
    }

    const pageElement = pageRef.current;
    if (!pageElement) {
      return;
    }
    const selectedModules = page.modules.filter((candidate) =>
      activeSelection.includes(candidate.id),
    );
    if (selectedModules.length === 0) {
      return;
    }

    const group = moduleBounds(selectedModules, page.width, page.height);
    const starts = new Map<string, Rect>();
    for (const selected of selectedModules) {
      starts.set(selected.id, rectOf(selected, page.width, page.height));
    }

    useEditorStore.getState().beginTransaction();
    dragRef.current = {
      kind: "move",
      startClientX: event.clientX,
      startClientY: event.clientY,
      pageRect: pageElement.getBoundingClientRect(),
      zoom,
      grid: page.grid,
      pageWidth: page.width,
      group,
      starts,
      moved: false,
    };

    onPointerMoveRef.current = (pointerEvent: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.kind !== "move") {
        return;
      }
      const dx = (pointerEvent.clientX - session.startClientX) / session.zoom;
      const dy = (pointerEvent.clientY - session.startClientY) / session.zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        session.moved = true;
      }
      if (!session.moved) {
        return;
      }

      const maxGroupX = Math.max(session.pageWidth - session.group.width, 0);
      const nextGroupX = clamp(
        snap(session.group.x + dx, session.grid),
        0,
        maxGroupX,
      );
      const nextGroupY = Math.max(
        0,
        snap(session.group.y + dy, session.grid),
      );
      const snappedDx = nextGroupX - session.group.x;
      const snappedDy = nextGroupY - session.group.y;

      useEditorStore.getState().updateTransient((draft) => {
        const activePage =
          draft.pages.find(
            (candidate) =>
              candidate.id === useEditorStore.getState().activePageId,
          ) ?? draft.pages[0];
        for (const moduleNode of activePage.modules) {
          const start = session.starts.get(moduleNode.id);
          if (!start) {
            continue;
          }
          const rect = {
            x: start.x + snappedDx,
            y: start.y + snappedDy,
            width: start.width,
            height: start.height,
          };
          Object.assign(
            moduleNode,
            rectToAnchored(
              moduleNode,
              activePage.width,
              activePage.height,
              rect,
            ),
          );
          clampAnchoredModule(moduleNode, activePage);
        }
        growPageHeight(activePage);
      });
    };

    startWindowTracking();
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLSpanElement>,
    module: ModuleNode,
    handle: ResizeHandle,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const pageElement = pageRef.current;
    if (!pageElement) {
      return;
    }
    const definition = getModuleDefinitionSafe(module.type);
    useEditorStore.getState().beginTransaction();
    dragRef.current = {
      kind: "resize",
      moduleId: module.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pageRect: pageElement.getBoundingClientRect(),
      zoom,
      grid: page.grid,
      pageWidth: page.width,
      startRect: {
        x: module.x,
        y: module.y,
        width: module.width,
        height: module.height,
      },
      minWidth: definition.minSize?.width ?? page.grid * 2,
      minHeight: definition.minSize?.height ?? page.grid * 2,
      moved: false,
    };

    onPointerMoveRef.current = (pointerEvent: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.kind !== "resize") {
        return;
      }
      const dx = (pointerEvent.clientX - session.startClientX) / session.zoom;
      const dy = (pointerEvent.clientY - session.startClientY) / session.zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        session.moved = true;
      }
      if (!session.moved) {
        return;
      }
      const rect = resizeRect(
        session.startRect,
        session.handle,
        dx,
        dy,
        {
          grid: session.grid,
          minWidth: session.minWidth,
          minHeight: session.minHeight,
          pageWidth: session.pageWidth,
        },
      );
      useEditorStore.getState().updateTransient((draft) => {
        const activePage =
          draft.pages.find(
            (candidate) =>
              candidate.id === useEditorStore.getState().activePageId,
          ) ?? draft.pages[0];
        const target = activePage.modules.find(
          (candidate) => candidate.id === session.moduleId,
        );
        if (target) {
          Object.assign(
            target,
            rectToAnchored(
              target,
              activePage.width,
              activePage.height,
              rect,
            ),
          );
          clampAnchoredModule(target, activePage);
        }
        growPageHeight(activePage);
      });
    };

    startWindowTracking();
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const next = zoom - event.deltaY * 0.0015;
    setZoom(next);
  };

  const pageStyle = {
    width: page.width,
    height: page.height,
    backgroundColor: page.background,
    transform: `scale(${zoom})`,
    backgroundImage: showGrid
      ? "radial-gradient(circle, rgba(128, 128, 128, 0.32) 1px, transparent 1.2px)"
      : "none",
    backgroundSize: `${page.grid}px ${page.grid}px`,
    "--grid": `${page.grid}px`,
    "--zoom": zoom,
  } as CSSProperties;

  return (
    <div className="canvas-root">
      <div className="canvas-viewport" ref={viewportRef} onWheel={handleWheel}>
        <div className="canvas-stage">
        <div
          className="page-scale"
          style={{
            width: page.width * zoom,
            height: page.height * zoom,
          }}
        >
          <div
            className="canvas-page"
            ref={pageRef}
            style={pageStyle}
            onDragOver={handleDragOver}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget as Node | null)
              ) {
                setDropGhost(null);
              }
            }}
            onDrop={handleDrop}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                clearSelection();
              }
            }}
          >
            <div
              className="canvas-page-content"
              style={pageAnimationStyle ?? undefined}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  clearSelection();
                }
              }}
            >
            {page.modules.map((module, index) => {
              const known = Boolean(getModuleDefinition(module.type));
              const definition = getModuleDefinitionSafe(module.type);
              const selected = selectedSet.has(module.id);
              const isSingle = singleSelected?.id === module.id;
              const moduleAnimationStyle = animationDockOpen
                ? keyframePreviewStyle(module.keyframes, animationTime)
                : null;
              const moduleRect = rectOf(module, page.width, page.height);
              return (
                <div
                  key={module.id}
                  className={clsx(
                    "canvas-module",
                    selected && "is-selected",
                    !known && "is-unknown",
                  )}
                  style={{
                    left: moduleRect.x,
                    top: moduleRect.y,
                    width: module.width,
                    height: module.height,
                    zIndex: index + 1,
                    ...(moduleAnimationStyle ?? {}),
                  }}
                  onPointerDown={(event) =>
                    handleModulePointerDown(event, module)
                  }
                  onContextMenu={(event) => openModuleMenu(event, module)}
                >
                  {known ? (
                    definition.render(module, { theme, preview: false })
                  ) : (
                    <div className="unknown-module">
                      <Scan size={18} />
                      <span>未知模块</span>
                      <small>{module.type}</small>
                    </div>
                  )}
                  {hasAnimations(module.animations) ? (
                    <span className="module-anim-badge" title="已设置动画">
                      <Wand2 size={11} />
                    </span>
                  ) : null}
                  {isSingle
                    ? handles.map((handle) => (
                        <span
                          key={handle}
                          className={clsx("resize-handle", `handle-${handle}`)}
                          onPointerDown={(event) =>
                            handleResizePointerDown(event, module, handle)
                          }
                        />
                      ))
                    : null}
                </div>
              );
            })}

            {dropGhost ? (
              <div
                className="drop-ghost"
                style={{
                  left: dropGhost.x,
                  top: dropGhost.y,
                  width: dropGhost.width,
                  height: dropGhost.height,
                }}
              >
                <Crosshair size={16} />
                <span>释放以添加</span>
              </div>
            ) : null}

            {page.modules.length === 0 ? (
              <div className="canvas-empty">
                <div className="canvas-empty-icon">
                  <Grid2X2 size={22} />
                </div>
                <strong>从左侧拖入模块</strong>
                <p>所有模块会自动吸附到 {page.grid}px 点阵网格。</p>
              </div>
            ) : null}
            </div>
          </div>
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="canvas-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="canvas-context-item"
            onClick={() => goToCode(contextMenu.moduleId)}
          >
            <Code2 size={14} />
            <span>转到代码</span>
            <small>{contextMenu.moduleId}</small>
          </button>
        </div>
      ) : null}

      <div className="canvas-hud">
        <span>
          {page.width} × {page.height}
        </span>
        <span className="hud-divider" />
        <span>网格 {page.grid}px</span>
        <span className="hud-divider" />
        <button type="button" onClick={fitPage} title="适应窗口">
          <Maximize2 size={13} />
          适应
        </button>
      </div>
    </div>
  );
}
