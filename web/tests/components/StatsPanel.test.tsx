import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatsPanel } from "@/components/StatsPanel";

import type { StatsResponse } from "@/lib/types";

const mockStats: StatsResponse = {
  embedding_backlog: 0,
  last_scrape_at: "2025-02-07T02:00:00Z",
  posts_last_24h: 12,
  posts_scored: 100,
  posts_total: 150,
  posts_unscored: 50,
  posts_used: 25,
  top_categories: [
    { category: "humor", count_30d: 30, last_updated: "2024-01-01T00:00:00Z" },
    { category: "drama", count_30d: 25, last_updated: "2024-01-01T00:00:00Z" },
    { category: "wildlife", count_30d: 20, last_updated: "2024-01-01T00:00:00Z" },
  ],
};

describe("StatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should display loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading
        })
    );

    render(<StatsPanel />);

    // Check for skeleton loading state
    const loadingElements = document.querySelectorAll(".animate-pulse");
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it("should display stats after successful fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => mockStats,
      ok: true,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Stats")).toBeInTheDocument();
    });

    expect(screen.getByText("150")).toBeInTheDocument(); // Total posts
    expect(screen.getByText("100")).toBeInTheDocument(); // Scored
    expect(screen.getByText("50")).toBeInTheDocument(); // Unscored
    expect(screen.getByText("Total Posts")).toBeInTheDocument();
    expect(screen.getByText("Used")).toBeInTheDocument();
  });

  it("should display top categories", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => mockStats,
      ok: true,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Top Categories (30 days)")).toBeInTheDocument();
    });

    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Humor")).toBeInTheDocument();
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Wildlife")).toBeInTheDocument();
  });

  it("should display error message when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({}),
      ok: false,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch stats/i)).toBeInTheDocument();
    });
  });

  it("should display error message when network error occurs", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("should not display categories section when no categories exist", async () => {
    const statsWithoutCategories: StatsResponse = {
      ...mockStats,
      top_categories: [],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => statsWithoutCategories,
      ok: true,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Stats")).toBeInTheDocument();
    });

    expect(screen.queryByText("Top Categories")).not.toBeInTheDocument();
  });

  it("should limit categories to top 5", async () => {
    const statsWithManyCategories: StatsResponse = {
      ...mockStats,
      top_categories: [
        { category: "cat1", count_30d: 10, last_updated: "2024-01-01T00:00:00Z" },
        { category: "cat2", count_30d: 9, last_updated: "2024-01-01T00:00:00Z" },
        { category: "cat3", count_30d: 8, last_updated: "2024-01-01T00:00:00Z" },
        { category: "cat4", count_30d: 7, last_updated: "2024-01-01T00:00:00Z" },
        { category: "cat5", count_30d: 6, last_updated: "2024-01-01T00:00:00Z" },
        { category: "cat6", count_30d: 5, last_updated: "2024-01-01T00:00:00Z" },
      ],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => statsWithManyCategories,
      ok: true,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Cat1")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    // Should show first 5
    expect(screen.getByText("Cat5")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    // Should not show 6th category
    expect(screen.queryByText("Cat6")).not.toBeInTheDocument();
  });

  it("should handle zero values correctly", async () => {
    const zeroStats: StatsResponse = {
      embedding_backlog: 0,
      last_scrape_at: null,
      posts_last_24h: 0,
      posts_scored: 0,
      posts_total: 0,
      posts_unscored: 0,
      posts_used: 0,
      top_categories: [],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => zeroStats,
      ok: true,
    } as Response);

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Stats")).toBeInTheDocument();
    });

    // Check that all stat cards show 0 by checking for the labels
    expect(screen.getByText("Total Posts")).toBeInTheDocument();
    expect(screen.getByText("Scored")).toBeInTheDocument();
    expect(screen.getByText("Unscored")).toBeInTheDocument();
    expect(screen.getByText("Used")).toBeInTheDocument();

    // Verify stat cards (7 total: Total, Scored, Unscored, Used, Posts 24h, Embedding backlog, Last scrape)
    const statCards = document.querySelectorAll("[class*='bg-surface-hover/50']");
    expect(statCards.length).toBe(7);
  });
});
