import { describe, expect, it } from "vitest";

import { cn, formatRelativeTime, POST_PREVIEW_LENGTH, truncate } from "@/lib/utils";

describe("cn", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "included", false && "excluded")).toBe("base included");
  });

  it("should merge tailwind classes correctly", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });
});

describe("truncate", () => {
  it("should return text as-is if shorter than limit", () => {
    expect(truncate("short text", 100)).toBe("short text");
  });

  it("should truncate long text with ellipsis within limit", () => {
    // maxLength includes the "..." so 8 chars means 5 content + 3 dots
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("should handle empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("should use POST_PREVIEW_LENGTH constant", () => {
    const longText = "a".repeat(500);
    const result = truncate(longText, POST_PREVIEW_LENGTH);

    // maxLength includes "..." so result should be exactly POST_PREVIEW_LENGTH
    expect(result.length).toBe(POST_PREVIEW_LENGTH);
  });
});

describe("formatRelativeTime", () => {
  it("should return 'Unknown' for null", () => {
    expect(formatRelativeTime(null)).toBe("Unknown");
  });

  it("should return 'Today' for same day", () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe("Today");
  });

  it("should return 'Yesterday' for previous day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeTime(yesterday.toISOString())).toBe("Yesterday");
  });

  it("should return days ago for recent dates", () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    expect(formatRelativeTime(fiveDaysAgo.toISOString())).toBe("5 days ago");
  });

  it("should return weeks ago for older dates", () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    expect(formatRelativeTime(twoWeeksAgo.toISOString())).toBe("2 weeks ago");
  });

  it("should handle future dates", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeTime(tomorrow.toISOString())).toBe("Tomorrow");
  });
});
