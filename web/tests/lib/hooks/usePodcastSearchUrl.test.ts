import { describe, expect, it } from "vitest";

import { isPodcastHomePath } from "@/lib/hooks/usePodcastSearchUrl";

describe("isPodcastHomePath", () => {
  it("should return true for podcast home paths", () => {
    expect(isPodcastHomePath("/")).toBe(true);
    expect(isPodcastHomePath("/podcast")).toBe(true);
  });

  it("should return false for other paths", () => {
    expect(isPodcastHomePath("/search")).toBe(false);
    expect(isPodcastHomePath("/episodes/foo")).toBe(false);
  });
});
