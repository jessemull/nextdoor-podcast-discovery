"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Weight Configurations
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        Switch between different weight configurations. Only configs with
        completed recompute jobs can be activated.
      </p>
      <div className="max-h-96 space-y-3 overflow-y-auto">
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
          const canActivate =
            (hasCompletedJob || config.has_scores) && !isActive;

          return (
            <div
              key={config.id}
              className="rounded border border-border bg-surface-hover/50 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <input
                        className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                        placeholder="Config name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      {renameError && (
                        <p className="text-destructive text-xs">
                          {renameError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-foreground text-sm font-medium">
                      {config.name ||
                        `Config ${config.id.substring(0, 8)}`}
                    </span>
                  )}
                  {!isEditing && isActive && (
                    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                      Active
                    </span>
                  )}
                  {!isEditing && hasRunningJob && !isActive && (
                    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                      Computing...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        disabled={isSaving}
                        variant="primary"
                        onClick={() => saveRename(config.id)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        disabled={isSaving}
                        variant="ghost"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => startEditing(config)}
                      >
                        Rename
                      </Button>
                      {canActivate && (
                        <Button
                          disabled={isActivating}
                          variant="primary"
                          onClick={() => onActivate(config.id)}
                        >
                          {isActivating ? "Activating..." : "Activate"}
                        </Button>
                      )}
                      {!isActive && !hasRunningJob && (
                        <Button
                          disabled={deletingConfigId === config.id}
                          variant="danger"
                          onClick={() => onDelete(config.id)}
                        >
                          {deletingConfigId === config.id
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isEditing ? (
                <textarea
                  className="mb-2 w-full rounded border border-border bg-surface-hover px-2 py-1 text-foreground text-xs focus:border-border-focus focus:outline-none focus:ring-1"
                  placeholder="Description (optional)"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              ) : (
                config.description && (
                  <p className="text-muted mb-2 text-xs">
                    {config.description}
                  </p>
                )
              )}
              <div className="text-muted-foreground mb-2 text-xs">
                <p>Created: {new Date(config.created_at).toLocaleString()}</p>
                {config.created_by && <p>By: {config.created_by}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(config.weights).map(([dim, weight]) => (
                  <span key={dim} className="text-muted">
                    {dim.replace(/_/g, " ")}: {weight.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
