"use client";

import { useEffect } from "react";

export type TopToastKind = "success" | "error" | "info";

export interface TopToastState {
  id: number;
  message: string;
  kind: TopToastKind;
}

interface TopToastProps {
  toasts: TopToastState[];
  onDismiss: (id: number) => void;
  durationMs?: number;
}

interface ToastItemProps {
  toast: TopToastState;
  onDismiss: (id: number) => void;
  durationMs: number;
}

function ToastItem({ toast, onDismiss, durationMs }: ToastItemProps) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDismiss(toast.id);
    }, durationMs);
    return () => window.clearTimeout(timeout);
  }, [toast.id, durationMs, onDismiss]);

  return (
    <div className={`rb-toast rb-toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      {toast.message}
    </div>
  );
}

export default function TopToast({ toasts, onDismiss, durationMs = 10_000 }: TopToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="rb-toast-wrap" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} durationMs={durationMs} />
      ))}
    </div>
  );
}
