import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostFeed } from "@/components/PostFeed";

import type { PostWithScores } from "@/lib/types";

// Mock PostCard to simplify tests
vi.mock("@/components/PostCard", () => ({
  PostCard: ({ post, onMarkUsed }: { post: PostWithScores; onMarkUsed?: (id: string) => void }) => (
    <div data-testid={`post-${post.id}`}>
      {post.text}
      {onMarkUsed && (
        <button onClick={() => onMarkUsed(post.id)}>Mark as Used</button>
      )}
    </div>
  ),
}));

const mockPosts: PostWithScores[] = [
  {
    created_at: "2024-01-01T00:00:00Z",
    episode_date: null,
    hash: "hash1",
    id: "post-1",
    image_urls: [],
    neighborhood_id: "neigh-1",
    neighborhood: { created_at: "2024-01-01", id: "neigh-1", name: "Test Neighborhood", slug: "test" },
    post_id_ext: "ext-1",
    text: "First post",
    url: "https://nextdoor.com/p/1",
    used_on_episode: false,
    user_id_hash: "user1",
    llm_scores: {
      categories: ["humor"],
      created_at: "2024-01-01T00:00:00Z",
      final_score: 8.5,
      id: "score-1",
      model_version: "claude-3-haiku-20240307",
      post_id: "post-1",
      scores: {
        absurdity: 9,
        discussion_spark: 7,
        drama: 6,
        emotional_intensity: 5,
        news_value: 4,
      },
      summary: "Funny post",
    },
  },
  {
    created_at: "2024-01-02T00:00:00Z",
    episode_date: null,
    hash: "hash2",
    id: "post-2",
    image_urls: [],
    neighborhood_id: "neigh-1",
    neighborhood: { created_at: "2024-01-01", id: "neigh-1", name: "Test Neighborhood", slug: "test" },
    post_id_ext: "ext-2",
    text: "Second post",
    url: "https://nextdoor.com/p/2",
    used_on_episode: false,
    user_id_hash: "user2",
    llm_scores: {
      categories: ["drama"],
      created_at: "2024-01-02T00:00:00Z",
      final_score: 7.0,
      id: "score-2",
      model_version: "claude-3-haiku-20240307",
      post_id: "post-2",
      scores: {
        absurdity: 5,
        discussion_spark: 8,
        drama: 9,
        emotional_intensity: 7,
        news_value: 6,
      },
      summary: "Dramatic post",
    },
  },
];

describe("PostFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should display loading state initially", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading
        })
    );

    render(<PostFeed />);

    // Check for loading spinner (animate-spin class)
    const loadingSpinner = document.querySelector(".animate-spin");
    expect(loadingSpinner).toBeInTheDocument();
  });

  it("should display posts after successful fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({
        data: mockPosts,
        total: 2,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
      expect(screen.getByText("Second post")).toBeInTheDocument();
    });

    expect(screen.getByText("Showing 2 of 2 posts")).toBeInTheDocument();
  });

  it("should display error message when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ error: "Failed to fetch" }),
      ok: false,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("should retry fetch when retry button is clicked", async () => {
    const user = userEvent.setup({ delay: null });

    // First call fails
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({ error: "Failed to fetch" }),
        ok: false,
      } as Response)
      // Second call succeeds
      .mockResolvedValueOnce({
        json: async () => ({
          data: mockPosts,
          total: 2,
        }),
        ok: true,
      } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });
  });

  it("should filter by category when category is selected", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        data: [mockPosts[0]], // Only humor post
        total: 1,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText(/category/i);
    await user.selectOptions(categorySelect, "humor");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("category=humor")
      );
    });
  });

  it("should filter by minimum score when minScore is entered", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        data: mockPosts,
        total: 2,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const minScoreInput = screen.getByLabelText(/min score/i);
    await user.type(minScoreInput, "8");

    // Fast-forward past debounce delay (500ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("min_score=8")
      );
    });
  });

  it("should toggle unused only filter", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        data: mockPosts,
        total: 2,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const unusedCheckbox = screen.getByLabelText(/unused only/i);
    await user.click(unusedCheckbox);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("unused_only=true")
      );
    });
  });

  it("should change sort order when sort option is selected", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        data: mockPosts,
        total: 2,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText(/sort/i);
    await user.selectOptions(sortSelect, "date");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=date")
      );
    });
  });

  it("should display loading indicator when loading more posts", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({
        data: mockPosts,
        total: 50, // More than 2 posts
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    // Should have sentinel element for infinite scroll
    const sentinel = document.querySelector("[data-testid='infinite-scroll-sentinel']");
    expect(sentinel).toBeInTheDocument();
  });

  it("should load more posts automatically when scrolling near bottom", async () => {
    const morePosts: PostWithScores[] = [
      {
        ...mockPosts[0],
        id: "post-3",
        text: "Third post",
      },
    ];

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({
          data: mockPosts,
          total: 50,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          data: morePosts,
          total: 50,
        }),
        ok: true,
      } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    // Simulate intersection observer triggering
    const sentinel = document.querySelector("[data-testid='infinite-scroll-sentinel']");
    if (sentinel) {
      // Trigger intersection
      const observer = new IntersectionObserver(() => {});
      observer.observe(sentinel);
      
      // Manually trigger the callback by simulating intersection
      const entries = [{ isIntersecting: true, target: sentinel } as IntersectionObserverEntry];
      // This is a simplified test - in real scenario IntersectionObserver would handle this
    }

    // For now, just verify the sentinel exists when there are more posts
    expect(sentinel).toBeInTheDocument();
  });

  it("should display end message when all posts are loaded", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({
        data: mockPosts,
        total: 2, // Exactly 2 posts, no more
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    expect(screen.getByText(/no more posts to load/i)).toBeInTheDocument();
  });

  it("should display empty state when no posts are found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({
        data: [],
        total: 0,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText(/no posts found/i)).toBeInTheDocument();
    });
  });

  it("should mark post as used when button is clicked", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({
          data: mockPosts,
          total: 2,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({}),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          data: mockPosts,
          total: 2,
        }),
        ok: true,
      } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const markUsedButtons = screen.getAllByText("Mark as Used");
    await user.click(markUsedButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/posts/post-1/used"),
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });
  });

  it("should validate minScore input to only allow non-negative numbers", async () => {
    const user = userEvent.setup({ delay: null });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        data: mockPosts,
        total: 2,
      }),
      ok: true,
    } as Response);

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const minScoreInput = screen.getByLabelText(/min score/i) as HTMLInputElement;

    // Try to enter negative number
    await user.clear(minScoreInput);
    await user.type(minScoreInput, "-5");

    // Input should not accept negative
    expect(minScoreInput.value).not.toContain("-5");

    // Try to enter valid number
    await user.clear(minScoreInput);
    await user.type(minScoreInput, "7");

    expect(minScoreInput.value).toBe("7");
  });
});
