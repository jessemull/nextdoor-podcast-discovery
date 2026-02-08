"use client";

interface SettingsAlertsProps {
  error: null | string;
  successMessage: null | string;
}

export function SettingsAlerts({ error, successMessage }: SettingsAlertsProps) {
  return (
    <>
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-800 bg-green-900/20 p-4">
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </>
  );
}
