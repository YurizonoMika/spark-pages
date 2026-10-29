import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  active = false,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: IconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties>({});

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    const element = buttonRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const above = rect.top > 54;
    setTipStyle({
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 90),
        window.innerWidth - 90,
      ),
      top: above ? rect.top - 8 : rect.bottom + 8,
      transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    });
    setOpen(true);
  }, [clearTimer]);

  const showDelayed = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(show, 320);
  }, [clearTimer, show]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const button = (
    <button
      {...props}
      ref={buttonRef}
      type="button"
      className={clsx("icon-button", active && "is-active", className)}
      aria-label={label}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        showDelayed();
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        hide();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        show();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        hide();
      }}
    >
      {children}
    </button>
  );

  return (
    <>
      {props.disabled ? (
        <span
          className="icon-button-disabled"
          onMouseEnter={showDelayed}
          onMouseLeave={hide}
        >
          {button}
        </span>
      ) : (
        button
      )}
      {open
        ? createPortal(
            <div className="tooltip" role="tooltip" style={tipStyle}>
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
