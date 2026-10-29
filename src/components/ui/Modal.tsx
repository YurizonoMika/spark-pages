import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "./IconButton";

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  size?: "md" | "lg" | "xl";
  dismissable?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  title,
  subtitle,
  icon,
  size = "md",
  dismissable = true,
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissable) {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dismissable, onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissable) {
          onClose();
        }
      }}
    >
      <div
        className={clsx(
          "modal",
          size === "lg" && "modal-lg",
          size === "xl" && "modal-xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <div className="modal-heading">
            {icon ? <span className="modal-icon">{icon}</span> : null}
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <IconButton
            label="关闭"
            className="modal-close"
            onClick={onClose}
            disabled={!dismissable}
          >
            <X size={16} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
