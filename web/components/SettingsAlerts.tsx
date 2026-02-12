"use client";

interface SettingsAlertsProps {
  error: null | string;
  successMessage: null | string;
}

export function SettingsAlerts({ error, successMessage }: SettingsAlertsProps) {
  return (
    <>
      {successMessage && (
        <div className="border-border bg-surface-hover mb-6 rounded-card border p-4">
          <p className="text-foreground text-sm">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="border-destructive bg-destructive/10 mb-6 rounded-card border p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </>
  );
}
