import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Eye, MousePointer2, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import clsx from "clsx";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { renderPageHtml } from "../../lib/renderHtml";
import { previewPointFromClient } from "../../lib/previewSelection";

function useDebouncedValue<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function PreviewPanel() {
  const page = useEditorStore(selectActivePage);
  const project = useEditorStore((state) => state.project);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setPageBuildOpen = useEditorStore(
    (state) => state.setPageBuildOpen,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [wandActive, setWandActive] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const html = useMemo(
    () => renderPageHtml(page, project, { preview: true }),
    [page, project],
  );
  const previewHtml = useDebouncedValue(html);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const update = () => {
      const available = Math.max(container.clientWidth - 56, 200);
      setScale(Math.min(1, available / page.width));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [page.width]);

  const postPreview = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { ...message, source: "spark-pages-app" },
      "*",
    );
  }, []);

  const syncSelected = useCallback(() => {
    postPreview({ type: "selection", ids: selection });
  }, [postPreview, selection]);

  const syncWand = useCallback(() => {
    postPreview({ type: "wand", active: wandActive });
    if (!wandActive) {
      postPreview({ type: "clear-hover" });
    }
  }, [postPreview, wandActive]);

  const syncPreview = useCallback(() => {
    syncSelected();
    syncWand();
  }, [syncSelected, syncWand]);

  const pointOf = useCallback(
    (clientX: number, clientY: number) => {
      const iframe = iframeRef.current;
      if (!iframe) {
        return null;
      }
      return previewPointFromClient(
        clientX,
        clientY,
        iframe.getBoundingClientRect(),
        page.width,
        page.height,
      );
    },
    [page.width, page.height],
  );

  const handleWandMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const point = pointOf(event.clientX, event.clientY);
      if (point) {
        postPreview({ type: "hover", x: point.x, y: point.y });
      }
    },
    [pointOf, postPreview],
  );

  const handleWandClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const point = pointOf(event.clientX, event.clientY);
      if (point) {
        postPreview({
          type: "select",
          x: point.x,
          y: point.y,
          multi: event.metaKey || event.ctrlKey || event.shiftKey,
        });
      }
    },
    [pointOf, postPreview],
  );

  const clearHover = useCallback(() => {
    postPreview({ type: "clear-hover" });
  }, [postPreview]);

  useEffect(() => {
    syncSelected();
  }, [syncSelected]);

  useEffect(() => {
    syncWand();
  }, [syncWand]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = event.data as
        | {
            source?: string;
            type?: string;
            id?: string | null;
            ids?: unknown;
          }
        | null;
      if (!data || data.source !== "spark-pages-preview") {
        return;
      }
      if (data.type === "ready") {
        syncPreview();
      } else if (data.type === "select") {
        const ids = Array.isArray(data.ids)
          ? data.ids.filter((id): id is string => typeof id === "string")
          : typeof data.id === "string"
            ? [data.id]
            : [];
        setSelection(ids);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setSelection, syncPreview]);

  const selectedCount = selection.length;

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="preview-title">
          <Eye size={15} />
          <span>实时预览</span>
          <small>{page.title}</small>
        </div>
        <div className="preview-toolbar-actions">
          {selectedCount > 0 ? (
            <span className="preview-selection">
              <MousePointer2 size={13} />
              已选中 {selectedCount}
            </span>
          ) : null}
          {wandActive ? (
            <small className="preview-wand-hint">
              点击多选 · ⌘/Ctrl/Shift 切换
            </small>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReplayKey((value) => value + 1)}
            title="重新播放页面动画"
          >
            <RotateCcw size={14} />
            重播
          </button>
          <button
            type="button"
            className={clsx("btn btn-ghost", wandActive && "is-active")}
            onClick={() => setWandActive((active) => !active)}
            title="选取预览中的组件"
          >
            <Wand2 size={14} />
            魔杖
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPageBuildOpen(true)}
          >
            <Sparkles size={14} />
            构建此页面
          </button>
        </div>
      </div>

      <div className="preview-scroll" ref={containerRef}>
        <div
          className="preview-frame-shell"
          style={{
            width: page.width * scale,
            height: page.height * scale,
          }}
        >
          <iframe
            key={replayKey}
            ref={iframeRef}
            className={clsx("preview-frame", wandActive && "is-wand")}
            title={`${page.title} 预览`}
            srcDoc={previewHtml}
            sandbox="allow-scripts allow-forms"
            style={{
              width: page.width,
              height: page.height,
              transform: `scale(${scale})`,
            }}
            onLoad={syncPreview}
          />
          {wandActive ? (
            <div
              className="preview-wand-layer"
              onPointerMove={handleWandMove}
              onPointerLeave={clearHover}
              onClick={handleWandClick}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
