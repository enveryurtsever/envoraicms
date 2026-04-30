"use client";

import { useEffect, useRef } from "react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  sm: 420,
  md: 560,
  lg: 760,
  xl: 960,
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: Size;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="adm-modal-backdrop" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        className="adm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        style={{ width: SIZE_PX[size] }}
      >
        {title ? (
          <div className="adm-modal__header">
            <h3>{title}</h3>
            <button
              type="button"
              className="adm-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="adm-modal__body">{children}</div>
        {footer ? <div className="adm-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? "btn danger" : "btn"}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {description ? (
        <p style={{ margin: 0, color: "#475569", fontSize: "0.92rem", lineHeight: 1.5 }}>
          {description}
        </p>
      ) : (
        <p style={{ margin: 0, color: "#475569" }}>This action cannot be undone.</p>
      )}
    </Modal>
  );
}
