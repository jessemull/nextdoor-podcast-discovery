"use client";

import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";

import type { Job, RankingWeights, WeightConfig } from "@/lib/types";

type MenuRef = React.RefObject<HTMLDivElement | null>;

/** Fixed order for weight dimensions (matches RankingWeightsEditor). */
const WEIGHT_KEYS: (keyof RankingWeights)[] = [
  "absurdity",
  "discussion_spark",
  "drama",
  "emotional_intensity",
  "news_value",
  "podcast_worthy",
  "readability",
];

const WEIGHT_DIMENSION_LABELS: Record<keyof RankingWeights, string> = {
  absurdity: "Absurdity",
  discussion_spark: "Discussion",
  drama: "Drama",
  emotional_intensity: "Intensity",
  news_value: "News",
  podcast_worthy: "Podcast",
  readability: "Readability",
};

const WEIGHT_BAR_GRADIENT =
  "linear-gradient(90deg, rgb(71 85 105), rgb(34 211 238))";

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
 * Bar chart for config weights (0–5 scale). Labeled rows: dimension name, bar, value.
 */
function WeightBarChart({ weights }: { weights: RankingWeights }) {
  return (
    <div className="space-y-2">
      <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
        Weights
      </h4>
      <div className="space-y-1.5">
        {WEIGHT_KEYS.map((key) => {
          const value = weights[key] ?? 0;
          const pct = Math.min(1, Math.max(0, value / 5)) * 100;
          const label = WEIGHT_DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
          return (
            <div
              key={key}
              className="flex items-center gap-3"
            >
              <span
                className="text-foreground w-24 shrink-0 text-xs"
                style={{ opacity: 0.85 }}
              >
                {label}
              </span>
              <div className="bg-surface-hover h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: WEIGHT_BAR_GRADIENT,
                    opacity: 0.9,
                  }}
                />
              </div>
              <span
                className="text-foreground w-8 shrink-0 text-right text-xs"
                style={{ opacity: 0.85 }}
              >
                {value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact weights: small chips/cards (label + score, no colon). For list cards.
 */
function WeightScoresCompact({ weights }: { weights: RankingWeights }) {
  return (
    <div className="space-y-2">
      <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
        Weights
      </h4>
      <div className="flex flex-wrap gap-2">
        {WEIGHT_KEYS.map((key) => {
          const value = weights[key] ?? 0;
          const label = WEIGHT_DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
          return (
            <span
              key={key}
              className="border-border bg-surface-hover text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
              style={{ opacity: 0.95 }}
            >
              <span>{label}</span>
              <span className="font-medium tabular-nums">
                {value.toFixed(1)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Derive per-config state from jobs and active id. */
function getConfigState(
  config: WeightConfig,
  activeConfigId: null | string,
  jobs: Job[]
) {
  const isActive = config.id === activeConfigId;
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
  const canDelete = !isActive && !hasRunningJob;
  const status: "active" | "computing" | "ready" | "no_scores" =
    isActive
      ? "active"
      : hasRunningJob
        ? "computing"
        : hasCompletedJob || config.has_scores
          ? "ready"
          : "no_scores";
  return { canActivate, canDelete, isActive, status };
}

interface ConfigCardProps {
  compactWeights?: boolean;
  config: WeightConfig;
  canActivate: boolean;
  canDelete: boolean;
  deletingConfigId: null | string;
  isActivating: boolean;
  menuOpen: boolean;
  menuRef: MenuRef;
  onActivate: (configId: string) => void;
  onDelete: (configId: string) => void;
  onMenuToggle: (configId: string) => void;
  onOpenRename: (config: WeightConfig) => void;
  status: "active" | "computing" | "ready" | "no_scores";
}

function ConfigCard({
  compactWeights = false,
  config,
  canActivate,
  canDelete,
  deletingConfigId,
  isActivating,
  menuOpen,
  menuRef,
  onActivate,
  onDelete,
  onMenuToggle,
  onOpenRename,
  status,
}: ConfigCardProps) {
  return (
    <div
      className="rounded border border-border bg-surface-hover/50 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-foreground min-w-0 truncate text-base font-semibold">
            {config.name?.trim() || `Config ${config.id.slice(0, 8)}`}
          </span>
          {status === "active" && (
            <span className="shrink-0 rounded border border-red-500/70 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
              Active
            </span>
          )}
          {status === "computing" && (
            <span className="shrink-0 rounded border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
              Computing…
            </span>
          )}
          {status === "ready" && (
            <span className="shrink-0 rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
              Ready
            </span>
          )}
          {status === "no_scores" && (
            <span className="border-border bg-surface-hover text-muted shrink-0 rounded border px-2 py-0.5 text-xs font-medium">
              No scores
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Edit name"
            className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
            type="button"
            onClick={() => onOpenRename(config)}
          >
            <Pencil aria-hidden className="h-4 w-4 text-foreground" />
          </button>
          {canActivate && (
            <button
              aria-label="Activate"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50"
              disabled={isActivating}
              type="button"
              onClick={() => onActivate(config.id)}
            >
              <Power aria-hidden className="h-4 w-4 text-foreground" />
            </button>
          )}
          {canDelete && (
            <button
              aria-label="Delete"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50"
              disabled={deletingConfigId === config.id}
              type="button"
              onClick={() => onDelete(config.id)}
            >
              <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
            </button>
          )}
          <div className="relative" ref={menuOpen ? menuRef : null}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="More actions"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
              type="button"
              onClick={() => onMenuToggle(config.id)}
            >
              <MoreHorizontal aria-hidden className="h-4 w-4 text-foreground" />
            </button>
            {menuOpen && (
              <div
                className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                role="menu"
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onMenuToggle(config.id);
                    onOpenRename(config);
                  }}
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                  Rename
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                  disabled={!canActivate || isActivating}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onMenuToggle(config.id);
                    if (canActivate) onActivate(config.id);
                  }}
                >
                  <Power aria-hidden className="h-4 w-4" />
                  {isActivating ? "Activating…" : "Activate"}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-surface-hover disabled:opacity-50"
                  disabled={!canDelete || deletingConfigId === config.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onMenuToggle(config.id);
                    if (canDelete) onDelete(config.id);
                  }}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  {deletingConfigId === config.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
          Description
        </h4>
        <p
          className="text-foreground text-xs"
          style={{ opacity: 0.85 }}
        >
          {config.description?.trim()
            ? config.description.trim()
            : "No Description"}
        </p>
      </div>

      {compactWeights ? (
        <WeightScoresCompact weights={config.weights} />
      ) : (
        <WeightBarChart weights={config.weights} />
      )}
    </div>
  );
}

/**
 * WeightConfigsList Component
 *
 * Displays active configuration (when set), then a list of all weight configurations
 * with bar chart, quick actions, and clear status/active state.
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
  const [menuOpenConfigId, setMenuOpenConfigId] = useState<null | string>(null);
  const [renameError, setRenameError] = useState<null | string>(null);
  const [savingConfigId, setSavingConfigId] = useState<null | string>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openRenameModal = useCallback((config: WeightConfig) => {
    setEditDescription(config.description ?? "");
    setEditName(config.name?.trim() ?? "");
    setEditingConfigId(config.id);
    setRenameError(null);
    setMenuOpenConfigId(null);
  }, []);

  const closeRenameModal = useCallback(() => {
    setEditingConfigId(null);
    setEditDescription("");
    setEditName("");
    setRenameError(null);
  }, []);

  const saveRename = useCallback(
    async (configId: string) => {
      if (!editName.trim()) {
        setRenameError("Enter a name");
        return;
      }
      setSavingConfigId(configId);
      setRenameError(null);
      try {
        const body: { description?: string; name?: string } = {
          name: editName.trim(),
        };
        if (editDescription.trim() !== "")
          body.description = editDescription.trim();
        const response = await fetch(`/api/admin/weight-configs/${configId}`, {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? data.details ?? "Failed to update");
        }
        closeRenameModal();
        onRenameSuccess?.();
      } catch (err) {
        setRenameError(
          err instanceof Error ? err.message : "Failed to update config"
        );
      } finally {
        setSavingConfigId(null);
      }
    },
    [
      editDescription,
      editName,
      closeRenameModal,
      onRenameSuccess,
    ]
  );

  useEffect(() => {
    if (menuOpenConfigId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpenConfigId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenConfigId(null);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenConfigId]);

  if (configs.length === 0) {
    return null;
  }

  const activeConfig =
    activeConfigId != null
      ? configs.find((c) => c.id === activeConfigId)
      : null;

  return (
    <>
      {/* Active configuration section */}
      {activeConfig && (
        <Card className="mb-8 p-6">
          <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
            Active configuration
          </h2>
          <p
            className="text-foreground mb-6 text-sm"
            style={{ opacity: 0.85 }}
          >
            The configuration currently used for ranking. Shown again below in the list.
          </p>
          <ConfigCard
            canActivate={getConfigState(activeConfig, activeConfigId, jobs).canActivate}
            canDelete={getConfigState(activeConfig, activeConfigId, jobs).canDelete}
            compactWeights={false}
            config={activeConfig}
            deletingConfigId={deletingConfigId}
            isActivating={isActivating}
            menuOpen={menuOpenConfigId === activeConfig.id}
            menuRef={menuRef}
            onActivate={onActivate}
            onDelete={onDelete}
            onMenuToggle={(id) =>
              setMenuOpenConfigId((current) => (current === id ? null : id))
            }
            onOpenRename={openRenameModal}
            status="active"
          />
        </Card>
      )}

      <Card className="mb-8 p-6">
        <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          Weight Configurations
        </h2>
        <p
          className="text-foreground mb-6 text-sm"
          style={{ opacity: 0.85 }}
        >
          Switch between different weight configurations. Only configs with
          completed recompute jobs can be activated. You can only delete a config
          when it is not active and has no job running.
        </p>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {configs.map((config) => {
            const state = getConfigState(config, activeConfigId, jobs);
            const menuOpen = menuOpenConfigId === config.id;
            return (
              <ConfigCard
                key={config.id}
                canActivate={state.canActivate}
                canDelete={state.canDelete}
                compactWeights={true}
                config={config}
                deletingConfigId={deletingConfigId}
                isActivating={isActivating}
                menuOpen={menuOpen}
                menuRef={menuRef}
                onActivate={onActivate}
                onDelete={onDelete}
                onMenuToggle={(id) =>
                  setMenuOpenConfigId((current) => (current === id ? null : id))
                }
                onOpenRename={openRenameModal}
                status={state.status}
              />
            );
          })}
        </div>

      {/* Rename modal */}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmDisabled={!editName.trim()}
        confirmLabel="Save"
        confirmLoading={savingConfigId != null}
        onCancel={closeRenameModal}
        onConfirm={() => editingConfigId && saveRename(editingConfigId)}
        open={editingConfigId != null}
        title="Edit config name"
      >
        <div className="space-y-3">
          <label className="block">
            <span
              className="text-foreground mb-1 block text-sm"
              style={{ opacity: 0.85 }}
            >
              Config name
            </span>
            <input
              autoFocus
              className="border-border bg-surface-hover text-foreground placeholder-muted-foreground focus:border-border-focus w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
              placeholder="e.g. Comedy focus"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </label>
          <label className="block">
            <span
              className="text-foreground mb-1 block text-sm"
              style={{ opacity: 0.85 }}
            >
              Description (optional)
            </span>
            <textarea
              className="border-border bg-surface-hover text-foreground placeholder-muted-foreground focus:border-border-focus w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
              placeholder="Optional note"
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </label>
          {renameError && (
            <p className="text-destructive text-xs">{renameError}</p>
          )}
        </div>
      </ConfirmModal>
      </Card>
    </>
  );
}
