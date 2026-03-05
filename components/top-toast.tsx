"use client";

import { useEffect } from "react";

export type TopToastKind = "success" | "error" | "info";

export interface TopToastState {
  id: number;
  message: string;
  kind: TopToastKind;
}

interface TopToastProps {
  toast: TopToastState | null;
  onDismiss: () => void;
  durationMs?: number;
}

export default function TopToast({ toast, onDismiss, durationMs = 2600 }: TopToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => window.clearTimeout(timeout);
  }, [toast?.id, toast, durationMs, onDismiss]);

  if (!toast) return null;

  return (
    <div className="rb-toast-wrap" aria-live="polite" aria-atomic="true">
      <div className={`rb-toast rb-toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
        {toast.message}
      </div>
    </div>
  );
}
