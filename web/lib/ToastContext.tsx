"use client";

import { createContext, useContext } from "react";
import { toast as sonnerToast, Toaster } from "sonner";

interface ToastContextValue {
  toast: {
    error: (message: string) => void;
    success: (message: string) => void;
  };
}

const toast = {
  error: (message: string) => sonnerToast.error(message),
  success: (message: string) => sonnerToast.success(message),
};

const ToastContext = createContext<null | ToastContextValue>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={{ toast }}>
      <Toaster position="bottom-right" richColors />
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value == null) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}
