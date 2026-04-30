"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./Modal";
import { useToast } from "./Toast";
import { Tooltip } from "./Tooltip";

// Renders a small "Delete" button. On click → confirm modal. On confirm →
// invokes the given server action with id (and optional extra fields), shows
// a toast, and refreshes the route.

export function RowDeleteButton({
  action,
  id,
  label = "Delete",
  confirmTitle = "Delete this item?",
  confirmDescription = "This action cannot be undone.",
  successMessage = "Deleted",
  className = "btn danger small",
}: {
  action: (fd: FormData) => Promise<void>;
  id: string | number;
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  successMessage?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("id", String(id));
        await action(fd);
        toast.success(successMessage);
        router.refresh();
        setOpen(false);
      } catch (err) {
        const m = err instanceof Error ? err.message : "Failed to delete";
        toast.error("Delete failed", m);
      }
    });
  }

  return (
    <>
      <Tooltip label="Delete">
        <button
          type="button"
          className={className}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Delete"
        destructive
        busy={pending}
      />
    </>
  );
}
