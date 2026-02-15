"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface SearchDefaults {
  similarity_threshold: number;
}

interface SearchDefaultsEditorProps {
  onSave: () => void;
  searchDefaults: SearchDefaults;
  setSearchDefaults: (defaults: SearchDefaults) => void;
}

const DEFAULT_SEARCH: SearchDefaults = {
  similarity_threshold: 0.2,
};

/**
 * SearchDefaultsEditor Component
 *
 * Configures the default similarity threshold for semantic search on the feed.
 * Lower values return more results; higher values are more precise.
 */
export function SearchDefaultsEditor({
  onSave,
  searchDefaults,
  setSearchDefaults,
}: SearchDefaultsEditorProps) {
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const handleConfirmSave = () => {
    setSaveConfirmOpen(false);
    onSave();
  };

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Search Defaults
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        Set the default similarity threshold for semantic search on the feed.
        Lower values return more, broader results; higher values return fewer,
        more precise matches.
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Adjust Defaults
      </h3>
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <label
            className="text-foreground text-sm font-medium"
            htmlFor="similarity-threshold"
            style={{ opacity: 0.85 }}
          >
            Similarity Threshold
          </label>
          <span className="text-foreground text-sm" style={{ opacity: 0.85 }}>
            {searchDefaults.similarity_threshold.toFixed(2)}
          </span>
        </div>
        <input
          className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-muted"
          id="similarity-threshold"
          max={1}
          min={0}
          step={0.05}
          type="range"
          value={searchDefaults.similarity_threshold}
          onChange={(e) =>
            setSearchDefaults({
              ...searchDefaults,
              similarity_threshold: parseFloat(e.target.value),
            })
          }
        />
        <div className="text-foreground mt-1 flex justify-between text-xs" style={{ opacity: 0.85 }}>
          <span>Broader (0.0)</span>
          <span>Precise (1.0)</span>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          className="border border-border"
          variant="ghost"
          onClick={() => setSearchDefaults({ ...DEFAULT_SEARCH })}
        >
          Defaults
        </Button>
        <Button variant="primary" onClick={() => setSaveConfirmOpen(true)}>
          Save
        </Button>
      </div>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Submit"
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        open={saveConfirmOpen}
        title="Update Search Defaults"
      >
        <p className="text-foreground text-sm" style={{ opacity: 0.85 }}>
          Save the default similarity threshold for the search results on the feed.
        </p>
      </ConfirmModal>
    </Card>
  );
}
