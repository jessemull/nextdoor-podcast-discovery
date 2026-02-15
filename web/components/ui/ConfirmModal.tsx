import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./Button";

export interface ConfirmModalProps {
  cancelLabel: string;
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmLoading?: boolean;
  counting?: boolean;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}

/**
 * Confirmation modal: backdrop blur, title, message or children, Cancel + Submit (lower right).
 * Matches existing UI tokens. Renders nothing when open is false.
 */
export function ConfirmModal({
  cancelLabel,
  children,
  confirmDisabled = false,
  confirmLabel,
  confirmLoading = false,
  counting = false,
  message,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      aria-labelledby="confirm-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
    >
      <div
        className={cn(
          "rounded-card border border-border bg-surface p-6 shadow-lg",
          "w-full max-w-md"
        )}
      >
        <h2
          className="text-foreground mb-2 text-lg font-semibold"
          id="confirm-modal-title"
        >
          {title}
        </h2>
        {counting ? (
          <div className="flex justify-center py-8">
            <div
              aria-hidden
              className="border-border-focus h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            />
          </div>
        ) : (
          <>
            {message != null ? (
              <p
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                {message}
              </p>
            ) : (
              <div
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                {children}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button
                disabled={confirmDisabled || confirmLoading}
                variant="primary"
                onClick={onConfirm}
              >
                {confirmLoading ? "..." : confirmLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
