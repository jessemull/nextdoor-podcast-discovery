import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScraperRunsSection } from "@/components/ScraperRunsSection";

import type { ScraperRun } from "@/lib/types";

describe("ScraperRunsSection", () => {
  it("shows completed badge when all attempted posts are saved", () => {
    const runs: ScraperRun[] = [
      {
        error_message: null,
        feed_type: "recent",
        id: "run-1",
        run_at: "2026-04-08T00:00:00.000Z",
        scoring_attempted_count: 10,
        scoring_error_count: 0,
        scoring_saved_count: 10,
        scoring_skipped_count: 0,
        status: "completed",
      },
    ];

    render(<ScraperRunsSection runs={runs} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
  });

  it("shows warning badge when scoring is partial", () => {
    const runs: ScraperRun[] = [
      {
        error_message: null,
        feed_type: "recent",
        id: "run-2",
        run_at: "2026-04-08T00:00:00.000Z",
        scoring_attempted_count: 500,
        scoring_error_count: 5,
        scoring_saved_count: 200,
        scoring_skipped_count: 295,
        status: "completed",
      },
    ];

    render(<ScraperRunsSection runs={runs} />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("200 / 500")).toBeInTheDocument();
  });
});
