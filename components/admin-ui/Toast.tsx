"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info" | "warn";

type Toast = {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
};

type ToastInput = {
  variant?: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
};

type Ctx = {
  push: (t: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const c = useContext(ToastContext);
  if (!c) throw new Error("useToast must be used inside <ToastProvider>");
  return c;
}

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    idCounter += 1;
    const t: Toast = {
      id: idCounter,
      variant: input.variant ?? "info",
      title: input.title,
      description: input.description,
      duration: input.duration ?? 4500,
    };
    setToasts((prev) => [...prev, t]);
  }, []);

  const ctx: Ctx = {
    push,
    success: (title, description) => push({ variant: "success", title, description }),
    error: (title, description) => push({ variant: "error", title, description, duration: 7000 }),
    info: (title, description) => push({ variant: "info", title, description }),
    warn: (title, description) => push({ variant: "warn", title, description, duration: 6000 }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="adm-toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.duration]);

  return (
    <div className={`adm-toast adm-toast--${toast.variant}`} role="status">
      <div className="adm-toast__icon" aria-hidden>
        {toast.variant === "success" ? "✓" : null}
        {toast.variant === "error" ? "!" : null}
        {toast.variant === "info" ? "i" : null}
        {toast.variant === "warn" ? "!" : null}
      </div>
      <div className="adm-toast__body">
        <div className="adm-toast__title">{toast.title}</div>
        {toast.description ? (
          <div className="adm-toast__desc">{toast.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="adm-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
