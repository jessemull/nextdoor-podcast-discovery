import {
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostFeed } from "@/components/PostFeed";

import type { PostWithScores } from "@/lib/types";

// Mock next/navigation for useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

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

const mockNeighborhoods = [
  { created_at: "2024-01-01", id: "neigh-1", name: "Test Neighborhood", slug: "test" },
];
const mockEpisodeDates: string[] = [];

const mockPosts: PostWithScores[] = [
  {
    created_at: "2024-01-01T00:00:00Z",
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

/** Default fetch mock: neighborhoods, episodes, then posts. Override per test as needed. */
function createFetchMock(postsResponse = { data: mockPosts, total: 2 }) {
  return (url: string | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("/api/neighborhoods")) {
      return Promise.resolve({
        json: async () => ({ data: mockNeighborhoods }),
        ok: true,
      } as Response);
    }
    if (u.includes("/api/episodes")) {
      return Promise.resolve({
        json: async () => ({ data: mockEpisodeDates }),
        ok: true,
      } as Response);
    }
    if (u.includes("/api/posts")) {
      return Promise.resolve({
        json: async () => postsResponse,
        ok: true,
      } as Response);
    }
    return Promise.resolve({ json: async () => ({}), ok: true } as Response);
  };
}

describe("PostFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockFetch = vi.fn();
    mockFetch.mockImplementation(createFetchMock());
    global.fetch = mockFetch;
  });

  it("should display initial loading state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<Response>(() => {
          // Never resolves to keep loading
        })
    );

    render(<PostFeed />);

    // Check for initial loading spinner (animate-spin class)
    const loadingSpinner = document.querySelector(".animate-spin");
    expect(loadingSpinner).toBeInTheDocument();
  });

  it("should display posts after successful fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
      expect(screen.getByText("Second post")).toBeInTheDocument();
    });

    expect(screen.getByText("Showing 2 of 2 posts")).toBeInTheDocument();
  });

  it("should display error message when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/posts")) {
        return Promise.resolve({
          json: async () => ({ error: "Failed to fetch" }),
          ok: false,
        } as Response);
      }
      return createFetchMock()(url);
    });

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("should retry fetch when retry button is clicked", async () => {
    const user = userEvent.setup();
    let postsCallCount = 0;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/posts")) {
        postsCallCount++;
        if (postsCallCount === 1) {
          return Promise.resolve({
            json: async () => ({ error: "Failed to fetch" }),
            ok: false,
          } as Response);
        }
        return Promise.resolve({
          json: async () => ({ data: mockPosts, total: 2 }),
          ok: true,
        } as Response);
      }
      return createFetchMock()(url);
    });

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
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: [mockPosts[0]], total: 1 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const humorCheckbox = screen.getByRole("checkbox", { name: /humor/i });
    await user.click(humorCheckbox);

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("category=humor")
        );
      },
      { timeout: 1000 }
    );
  });

  it("should filter by minimum score when minScore is entered", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const sidebar = screen.getByRole("complementary", { name: /filter posts/i });
    const minScoreInput = within(sidebar).getByLabelText(/min score/i);
    await user.type(minScoreInput, "8");

    // Wait for debounce delay (500ms) plus a small buffer
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("min_score=8")
        );
      },
      { timeout: 1000 }
    );
  });

  it("should toggle unused only filter", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

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
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText(/sort posts/i);
    await user.selectOptions(sortSelect, "Newest first");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=date")
      );
    });
  });

  it("should display sentinel element when more posts are available", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 50 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    // Should have sentinel element for infinite scroll
    const sentinel = document.querySelector("[data-testid='infinite-scroll-sentinel']");
    expect(sentinel).toBeInTheDocument();
  });

  it("should not display sentinel when all posts are loaded", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    // Should not have sentinel when all posts are loaded
    const sentinel = document.querySelector("[data-testid='infinite-scroll-sentinel']");
    expect(sentinel).not.toBeInTheDocument();
  });

  it("should display end message when all posts are loaded", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    expect(screen.getByText(/no more posts to load/i)).toBeInTheDocument();
  });

  it("should display empty state when no posts are found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: [], total: 0 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText(/no posts found/i)).toBeInTheDocument();
    });
  });

  it("should mark post as used when button is clicked", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url, opts) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/used") && opts?.method === "PATCH") {
        return Promise.resolve({
          json: async () => ({}),
          ok: true,
        } as Response);
      }
      return createFetchMock()(url);
    });

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

  it("should reset filters when Reset filters button is clicked", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const humorCheckbox = screen.getByRole("checkbox", { name: /humor/i });
    await user.click(humorCheckbox);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("category=humor")
      );
    });

    const resetButton = screen.getByRole("button", {
      name: /reset filters/i,
    });
    await user.click(resetButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining("category=humor")
      );
    });
    expect(humorCheckbox).not.toBeChecked();
  });

  it("should validate minScore input to only allow non-negative numbers", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      createFetchMock({ data: mockPosts, total: 2 })
    );

    render(<PostFeed />);

    await waitFor(() => {
      expect(screen.getByText("First post")).toBeInTheDocument();
    });

    const sidebar = screen.getByRole("complementary", { name: /filter posts/i });
    const minScoreInput = within(sidebar).getByLabelText(
      /min score/i
    ) as HTMLInputElement;

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
