import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PodcastPicks } from "@/components/PodcastPicks";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockPost = {
  created_at: "2025-02-01T12:00:00Z",
  episode_date: null,
  hash: "abc",
  id: "post-1",
  image_urls: [],
  llm_scores: {
    categories: ["humor"],
    created_at: "2025-02-01T12:00:00Z",
    final_score: 8.5,
    id: "score-1",
    model_version: "claude-3-haiku",
    post_id: "post-1",
    scores: { absurdity: 8, drama: 7 },
    summary: "A funny post",
    why_podcast_worthy: null,
  },
  neighborhood: { created_at: "", id: "n1", name: "Test", slug: "test" },
  neighborhood_id: "n1",
  post_id_ext: "ext-1",
  reaction_count: 0,
  saved: false,
  text: "Sample post text",
  url: null,
  used_on_episode: false,
  user_id_hash: null,
};

function WrappedPodcastPicks() {
  return (
    <Suspense
      fallback={
        <div data-testid="suspense-fallback">Loading Podcast Picks...</div>
      }
    >
      <PodcastPicks />
    </Suspense>
  );
}

describe("PodcastPicks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should display loading skeleton initially", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<Response>(() => {
          // Never resolves
        })
    );

    render(<WrappedPodcastPicks />);

    await waitFor(() => {
      const heading = screen.getByText("Podcast Picks");
      expect(heading).toBeInTheDocument();
    });

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should display empty state when no picks returned", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ data: [], total: 0 }),
      ok: true,
    } as Response);

    render(<WrappedPodcastPicks />);

    await waitFor(() => {
      expect(
        screen.getByText("No picks in this range yet.")
      ).toBeInTheDocument();
    });
  });

  it("should display picks after successful fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ data: [mockPost], total: 1 }),
      ok: true,
    } as Response);

    render(<WrappedPodcastPicks />);

    await waitFor(() => {
      expect(screen.getByText("Sample post text")).toBeInTheDocument();
    });

    expect(screen.getByText("Podcast Picks")).toBeInTheDocument();
    expect(screen.getByText(/Top posts \(score ≥/)).toBeInTheDocument();
  });
});
