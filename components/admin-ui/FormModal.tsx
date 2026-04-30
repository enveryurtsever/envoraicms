"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

// Generic form-in-modal: uses a server action via the standard form action prop,
// shows a toast on success, refreshes the route, and closes the modal. The
// server action is expected to NOT redirect when invoked from this modal flow
// (or to throw on validation errors). Validation errors should call back via
// returning a status — we keep this simple: success → toast + close, throw
// → toast error.

export function FormModal({
  open,
  onClose,
  title,
  size = "lg",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  action,
  successMessage = "Saved",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
  submitLabel?: string;
  cancelLabel?: string;
  action: (fd: FormData) => Promise<void>;
  successMessage?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        router.refresh();
        onClose();
      } catch (err) {
        const m = err instanceof Error ? err.message : "Operation failed";
        toast.error("Something went wrong", m);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      size={size}
      footer={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            form="adm-form-modal"
            className="btn"
            disabled={pending}
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <form id="adm-form-modal" action={handleSubmit} autoComplete="off">
        {children}
      </form>
    </Modal>
  );
}
