"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin-ui/Modal";
import { useToast } from "@/components/admin-ui/Toast";

export function ConfirmActionButton({
  action,
  id,
  label,
  confirmLabel,
  title,
  description,
  successMessage,
}: {
  action: (fd: FormData) => Promise<void>;
  id?: number;
  label: string;
  confirmLabel: string;
  title: string;
  description: string;
  successMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        if (id !== undefined) fd.append("id", String(id));
        await action(fd);
        toast.success(successMessage);
        router.refresh();
        setOpen(false);
      } catch (err) {
        toast.error("Action failed", err instanceof Error ? err.message : undefined);
      }
    });
  }

  return (
    <>
      <button type="button" className="btn secondary small" onClick={() => setOpen(true)}>
        {label}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive
        busy={pending}
      />
    </>
  );
}
