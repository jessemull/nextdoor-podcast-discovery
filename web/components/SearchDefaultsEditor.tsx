"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface SearchDefaults {
  similarity_threshold: number;
}

interface SearchDefaultsEditorProps {
  isSaving: boolean;
  onSave: () => void;
  searchDefaults: SearchDefaults;
  setSearchDefaults: (defaults: SearchDefaults) => void;
}

/**
 * SearchDefaultsEditor Component
 *
 * Allows users to configure default settings for semantic search.
 */
export function SearchDefaultsEditor({
  isSaving,
  onSave,
  searchDefaults,
  setSearchDefaults,
}: SearchDefaultsEditorProps) {
  return (
    <Card className="mb-8 p-6">
      <h2 className="mb-4 text-foreground text-lg font-semibold">
        Search Defaults
      </h2>
      <p className="text-muted mb-6 text-sm">
        Configure default settings for semantic search.
      </p>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label
            className="text-muted-foreground text-sm font-medium"
            htmlFor="similarity-threshold"
          >
            Similarity Threshold
          </label>
          <span className="text-muted text-sm">
            {searchDefaults.similarity_threshold.toFixed(2)}
          </span>
        </div>
        <input
          className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
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
        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
          <span>Broader (0.0)</span>
          <span>Precise (1.0)</span>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Lower values return more results, higher values are more precise.
        </p>
      </div>

      <Button disabled={isSaving} variant="primary" onClick={onSave}>
        {isSaving ? "Saving..." : "Save Search Defaults"}
      </Button>
    </Card>
  );
}
