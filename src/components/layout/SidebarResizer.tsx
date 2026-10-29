import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  LEFT_MAX_WIDTH,
  LEFT_MIN_WIDTH,
  RIGHT_MAX_WIDTH,
  RIGHT_MIN_WIDTH,
  useLayoutStore,
} from "../../store/layoutStore";

interface SidebarResizerProps {
  side: "left" | "right";
}

export function SidebarResizer({ side }: SidebarResizerProps) {
  const width = useLayoutStore((state) =>
    side === "left" ? state.leftWidth : state.rightWidth,
  );
  const setLeftWidth = useLayoutStore((state) => state.setLeftWidth);
  const setRightWidth = useLayoutStore((state) => state.setRightWidth);

  const setWidth = (value: number) => {
    if (side === "left") {
      setLeftWidth(value);
    } else {
      setRightWidth(value);
    }
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    document.body.classList.add("is-resizing-sidebars");

    const move = (pointerEvent: PointerEvent) => {
      const delta = pointerEvent.clientX - startX;
      setWidth(side === "left" ? startWidth + delta : startWidth - delta);
    };
    const finish = () => {
      document.body.classList.remove("is-resizing-sidebars");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const delta = side === "left" ? direction * step : -direction * step;
    setWidth(width + delta);
  };

  return (
    <div
      className={`sidebar-resizer sidebar-resizer-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`调整${side === "left" ? "左" : "右"}侧栏宽度`}
      aria-valuemin={side === "left" ? LEFT_MIN_WIDTH : RIGHT_MIN_WIDTH}
      aria-valuemax={side === "left" ? LEFT_MAX_WIDTH : RIGHT_MAX_WIDTH}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="拖动调整宽度，双击恢复默认"
      onPointerDown={startResize}
      onDoubleClick={() =>
        setWidth(
          side === "left" ? DEFAULT_LEFT_WIDTH : DEFAULT_RIGHT_WIDTH,
        )
      }
      onKeyDown={handleKeyDown}
    >
      <span />
    </div>
  );
}
