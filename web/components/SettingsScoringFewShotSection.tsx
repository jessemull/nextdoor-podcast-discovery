"use client";

import { ChevronDown, ChevronRight, ChevronUp, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TOPIC_CATEGORIES } from "@/lib/constants";
import { useToast } from "@/lib/ToastContext";
import { cn } from "@/lib/utils";
import {
  SCORING_FEW_SHOT_MAX_EXAMPLES,
  scoringFewShotConfigSchema,
  type ScoringFewShotConfig,
  VALID_WEIGHT_DIMENSIONS,
} from "@/lib/validators";

export type ScoringFewShotDraft = {
  examples: ScoringFewShotConfig["examples"];
  intro: string;
};

/** e.g. local_news → Local News, discussion_spark → Discussion Spark */
function formatSnakeCaseTitle(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const textareaClassName =
  "border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus";

const scoreInputClassName =
  "border-border bg-surface-hover text-foreground min-h-10 w-full min-w-0 rounded border px-3 py-2 text-left text-sm tabular-nums " +
  "focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const labelStyle = { opacity: 0.85 };

/** Uppercase section titles inside an expanded example (Categories, Ideal Scores, Summary & rationale, …). */
const accordionSectionTitleClass =
  "text-foreground mb-3 text-xs font-semibold uppercase tracking-wide";

/** Same label → control spacing as Summary / Post UUID (text-sm + gap-2 pattern). */
const fieldLabelClass = "text-foreground block text-sm font-medium";

function truncatePreview(text: string, maxLen: number): string {
  const t = text.trim();
  if (!t) {
    return "";
  }
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

interface SettingsScoringFewShotSectionProps {
  onChange: (value: ScoringFewShotDraft) => void;
  value: ScoringFewShotDraft;
}

/**
 * Admin: configure LLM scoring few-shot (settings.scoring_few_shot). Required for scraper scoring.
 */
export function SettingsScoringFewShotSection({
  onChange,
  value,
}: SettingsScoringFewShotSectionProps) {
  const { toast } = useToast();
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());

  const toggleExampleExpanded = useCallback((postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  const setIntro = useCallback(
    (intro: string) => {
      onChange({ ...value, intro });
    },
    [onChange, value]
  );

  const removeExample = useCallback(
    (index: number) => {
      const removed = value.examples[index]?.post_id;
      onChange({
        ...value,
        examples: value.examples.filter((_, i) => i !== index),
      });
      if (removed) {
        setExpandedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(removed);
          return next;
        });
      }
    },
    [onChange, value]
  );

  const moveExample = useCallback(
    (index: number, delta: number) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= value.examples.length) {
        return;
      }
      const examples = [...value.examples];
      const tmp = examples[index];
      const swap = examples[nextIndex];
      if (!tmp || !swap) {
        return;
      }
      examples[index] = swap;
      examples[nextIndex] = tmp;
      onChange({ ...value, examples });
    },
    [onChange, value]
  );

  const patchIdeal = useCallback(
    (
      index: number,
      patch: Partial<ScoringFewShotConfig["examples"][number]["ideal"]>
    ) => {
      const examples = value.examples.map((ex, i) => {
        if (i !== index) {
          return ex;
        }
        return { ...ex, ideal: { ...ex.ideal, ...patch } };
      });
      onChange({ ...value, examples });
    },
    [onChange, value]
  );

  const patchScore = useCallback(
    (index: number, dim: (typeof VALID_WEIGHT_DIMENSIONS)[number], num: number) => {
      const ex = value.examples[index];
      if (!ex) {
        return;
      }
      patchIdeal(index, {
        scores: { ...ex.ideal.scores, [dim]: num },
      });
    },
    [patchIdeal, value.examples]
  );

  const toggleCategory = useCallback(
    (index: number, cat: string) => {
      const ex = value.examples[index];
      if (!ex) {
        return;
      }
      const set = new Set(ex.ideal.categories);
      if (set.has(cat)) {
        set.delete(cat);
      } else {
        set.add(cat);
      }
      patchIdeal(index, { categories: Array.from(set).sort() });
    },
    [patchIdeal, value.examples]
  );

  const handleSave = useCallback(async () => {
    const parsed = scoringFewShotConfigSchema.safeParse({
      examples: value.examples,
      intro: value.intro,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid few-shot config";
      toast.error(msg);
      return;
    }
    try {
      const res = await fetch("/api/settings", {
        body: JSON.stringify({ scoring_few_shot: parsed.data }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details || "Save failed");
      }
      toast.success("Scoring Few Shot saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    }
  }, [toast, value]);

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Scoring Few Shot
      </h2>
      <p className="text-foreground mb-6 text-sm" style={{ opacity: 0.85 }}>
        Required before the scraper can score posts. Add reference posts from the admin feed.
        Set ideal scores
        and copy the model should mimic here. After changes, re-score posts and recompute final
        scores if needed. Limited to six examples to limit blast radius and API cost.
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold tracking-wide" id="few-shot-intro-heading">
        Intro
      </h3>
      <textarea
        aria-labelledby="few-shot-intro-heading"
        aria-required
        className={`${textareaClassName} mb-8 min-h-[150px]`}
        id="few-shot-intro"
        placeholder="Explain the comedy podcast bar and when dimensions should be high or low."
        value={value.intro}
        onChange={(e) => {
          setIntro(e.target.value);
        }}
      />

      <h3 className="text-foreground mb-4 text-base font-semibold tracking-wide">
        Examples ({value.examples.length}/{SCORING_FEW_SHOT_MAX_EXAMPLES})
      </h3>
      <p className="text-muted mb-4 text-xs">Use the arrows to re-order the examples.</p>
      <div className="space-y-5">
        {value.examples.map((ex, index) => {
          const expanded = expandedPostIds.has(ex.post_id);
          const summaryPreview = truncatePreview(ex.ideal.summary, 100);
          const subtitle =
            summaryPreview ||
            "No summary yet — expand to add ideal scores and copy.";
          return (
            <div
              key={ex.post_id}
              className="border-border min-w-0 space-y-4 rounded-lg border p-5"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2">
                <button
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} example ${index + 1}`}
                  className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 text-left text-foreground"
                  type="button"
                  onClick={() => {
                    toggleExampleExpanded(ex.post_id);
                  }}
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "text-muted h-4 w-4 shrink-0 transition-transform",
                      expanded && "rotate-90"
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span
                      className="text-foreground shrink-0 font-sans text-xs font-medium uppercase leading-tight"
                      style={labelStyle}
                    >
                      Example #{index + 1}
                    </span>
                    <span
                      className="text-foreground min-w-0 break-all font-mono text-xs font-medium leading-tight"
                      style={labelStyle}
                      title={ex.post_id}
                    >
                      ({ex.post_id})
                    </span>
                  </span>
                </button>
                <div className="col-start-2 row-start-1 flex items-center justify-end gap-1">
                  <button
                    aria-label="Move example up"
                    className="text-muted hover:text-foreground p-1 disabled:opacity-30"
                    disabled={index === 0}
                    type="button"
                    onClick={() => {
                      moveExample(index, -1);
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Move example down"
                    className="text-muted hover:text-foreground p-1 disabled:opacity-30"
                    disabled={index === value.examples.length - 1}
                    type="button"
                    onClick={() => {
                      moveExample(index, 1);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Remove example"
                    className="text-muted hover:text-destructive p-1"
                    type="button"
                    onClick={() => {
                      removeExample(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="col-start-1 row-start-2 min-w-0">
                  <button
                    aria-expanded={expanded}
                    className="text-foreground w-full pl-6 text-left"
                    type="button"
                    onClick={() => {
                      toggleExampleExpanded(ex.post_id);
                    }}
                  >
                    <p className="text-muted line-clamp-2 text-sm">{subtitle}</p>
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="border-border space-y-5 border-t pt-4">
                  <div>
                    <h4 className={accordionSectionTitleClass}>Categories (1–3)</h4>
                    <div className="flex flex-wrap gap-3">
                      {TOPIC_CATEGORIES.map((cat) => (
                        <label
                          key={cat}
                          className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                          style={{ opacity: 0.85 }}
                        >
                          <input
                            checked={ex.ideal.categories.includes(cat)}
                            className="border-border text-foreground focus:ring-border-focus h-4 w-4 rounded border bg-surface-hover"
                            type="checkbox"
                            onChange={() => {
                              toggleCategory(index, cat);
                            }}
                          />
                          {formatSnakeCaseTitle(cat)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className={accordionSectionTitleClass}>Ideal Scores</h4>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
                      {VALID_WEIGHT_DIMENSIONS.map((dim) => (
                        <div
                          key={dim}
                          className="flex min-h-0 min-w-0 flex-col self-stretch"
                        >
                          <label
                            className={cn(
                              fieldLabelClass,
                              "mb-2 line-clamp-2 leading-tight"
                            )}
                            htmlFor={`${dim}-${index}`}
                            style={labelStyle}
                            title={formatSnakeCaseTitle(dim)}
                          >
                            {formatSnakeCaseTitle(dim)}
                          </label>
                          <input
                            className={cn(scoreInputClassName, "mt-auto")}
                            id={`${dim}-${index}`}
                            max={10}
                            min={1}
                            step={0.1}
                            type="number"
                            value={ex.ideal.scores[dim]}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value);
                              if (!Number.isNaN(n)) {
                                patchScore(index, dim, Math.min(10, Math.max(1, n)));
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className={accordionSectionTitleClass}>Summary & rationale</h4>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label
                          className={fieldLabelClass}
                          htmlFor={`summary-${index}`}
                          style={labelStyle}
                        >
                          Summary
                        </label>
                        <textarea
                          className={`${textareaClassName} mb-0`}
                          id={`summary-${index}`}
                          rows={2}
                          value={ex.ideal.summary}
                          onChange={(e) => {
                            patchIdeal(index, { summary: e.target.value });
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label
                          className={fieldLabelClass}
                          htmlFor={`why-${index}`}
                          style={labelStyle}
                        >
                          Why Podcast Worthy
                        </label>
                        <textarea
                          className={textareaClassName}
                          id={`why-${index}`}
                          rows={2}
                          value={ex.ideal.why_podcast_worthy}
                          onChange={(e) => {
                            patchIdeal(index, { why_podcast_worthy: e.target.value });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button type="button" onClick={() => void handleSave()}>
          Save Scoring Few Shot
        </Button>
      </div>
    </Card>
  );
}
