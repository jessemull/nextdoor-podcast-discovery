import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
