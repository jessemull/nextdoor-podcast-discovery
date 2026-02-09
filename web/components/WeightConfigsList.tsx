"use client";

import { useState } from "react";

import type { Job, WeightConfig } from "@/lib/types";

interface WeightConfigsListProps {
  activeConfigId: null | string;
  configs: WeightConfig[];
  deletingConfigId: null | string;
  isActivating: boolean;
  jobs: Job[];
  onActivate: (configId: string) => void;
  onDelete: (configId: string) => void;
  onRenameSuccess?: () => void;
}

/**
 * WeightConfigsList Component
 *
 * Displays a list of weight configurations with options to activate, rename, or delete them.
 */
export function WeightConfigsList({
  activeConfigId,
  configs,
  deletingConfigId,
  isActivating,
  jobs,
  onActivate,
  onDelete,
  onRenameSuccess,
}: WeightConfigsListProps) {
  const [editingConfigId, setEditingConfigId] = useState<null | string>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState<null | string>(null);
  const [savingConfigId, setSavingConfigId] = useState<null | string>(null);

  const startEditing = (config: WeightConfig) => {
    setEditDescription(config.description ?? "");
    setEditName(config.name ?? "");
    setEditingConfigId(config.id);
    setRenameError(null);
  };

  const cancelEditing = () => {
    setEditingConfigId(null);
    setEditDescription("");
    setEditName("");
    setRenameError(null);
  };

  const saveRename = async (configId: string) => {
    setSavingConfigId(configId);
    setRenameError(null);
    try {
      const body: { description?: string; name?: string } = {};
      if (editName.trim() !== "") body.name = editName.trim();
      if (editDescription.trim() !== "") body.description = editDescription.trim();
      if (Object.keys(body).length === 0) {
        setRenameError("Enter a name or description");
        return;
      }
      const response = await fetch(`/api/admin/weight-configs/${configId}`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? data.details ?? "Failed to update");
      }
      cancelEditing();
      onRenameSuccess?.();
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to update config"
      );
    } finally {
      setSavingConfigId(null);
    }
  };

  if (configs.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Weight Configurations</h2>
      <p className="mb-6 text-sm text-gray-400">
        Switch between different weight configurations. Only configs with completed recompute jobs
        can be activated.
      </p>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {configs.map((config) => {
          const isActive = config.id === activeConfigId;
          const isEditing = editingConfigId === config.id;
          const isSaving = savingConfigId === config.id;
          const hasCompletedJob = jobs.some(
            (job) =>
              job.status === "completed" &&
              job.params?.weight_config_id === config.id
          );
          const hasRunningJob = jobs.some(
            (job) =>
              (job.status === "running" || job.status === "pending") &&
              job.params?.weight_config_id === config.id
          );
          const canActivate = (hasCompletedJob || config.has_scores) && !isActive;

          return (
            <div key={config.id} className="rounded border border-gray-700 bg-gray-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <input
                        className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Config name"
                        value={editName}
                      />
                      {renameError && (
                        <p className="text-xs text-red-400">{renameError}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-300">
                      {config.name || `Config ${config.id.substring(0, 8)}`}
                    </span>
                  )}
                  {!isEditing && isActive && (
                    <span className="rounded bg-green-900 px-2 py-0.5 text-xs text-green-200">
                      Active
                    </span>
                  )}
                  {!isEditing && hasRunningJob && !isActive && (
                    <span className="rounded bg-yellow-900 px-2 py-0.5 text-xs text-yellow-200">
                      Computing...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        className="rounded bg-gray-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSaving}
                        onClick={() => saveRename(config.id)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="rounded border border-gray-500 px-3 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
                        disabled={isSaving}
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded bg-gray-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => startEditing(config)}
                      >
                        Rename
                      </button>
                      {canActivate && (
                        <button
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isActivating}
                          onClick={() => onActivate(config.id)}
                        >
                          {isActivating ? "Activating..." : "Activate"}
                        </button>
                      )}
                      {!isActive && !hasRunningJob && (
                        <button
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={deletingConfigId === config.id}
                          onClick={() => onDelete(config.id)}
                        >
                          {deletingConfigId === config.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isEditing ? (
                <textarea
                  className="mb-2 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white"
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  value={editDescription}
                />
              ) : (
                config.description && (
                  <p className="mb-2 text-xs text-gray-400">{config.description}</p>
                )
              )}
              <div className="mb-2 text-xs text-gray-500">
                <p>Created: {new Date(config.created_at).toLocaleString()}</p>
                {config.created_by && <p>By: {config.created_by}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(config.weights).map(([dim, weight]) => (
                  <span key={dim} className="text-gray-400">
                    {dim.replace(/_/g, " ")}: {weight.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
