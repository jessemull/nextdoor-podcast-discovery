import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "@/lib/hooks";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));

    expect(result.current).toBe("initial");
  });

  it("should debounce value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { delay: 500, value: "initial" },
      }
    );

    expect(result.current).toBe("initial");

    // Change value
    rerender({ delay: 500, value: "updated" });

    // Should still be initial (not debounced yet)
    expect(result.current).toBe("initial");

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should now be updated
    expect(result.current).toBe("updated");
  });

  it("should use custom delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { delay: 1000, value: "initial" },
      }
    );

    rerender({ delay: 1000, value: "updated" });

    // Should not update after 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("initial");

    // Should update after full delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("updated");
  });

  it("should use default delay of 300ms when not specified", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "updated" });

    // Should not update after 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("initial");

    // Should update after 300ms (default)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("updated");
  });

  it("should cancel previous timeout when value changes rapidly", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { delay: 500, value: "initial" },
      }
    );

    // Rapid changes
    rerender({ delay: 500, value: "change1" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ delay: 500, value: "change2" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ delay: 500, value: "change3" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should still be initial (none of the changes completed)
    expect(result.current).toBe("initial");

    // Complete the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should be the last value
    expect(result.current).toBe("change3");
  });

  it("should handle number values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { delay: 500, value: 0 },
      }
    );

    expect(result.current).toBe(0);

    rerender({ delay: 500, value: 42 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(42);
  });

  it("should handle boolean values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { delay: 500, value: false },
      }
    );

    expect(result.current).toBe(false);

    rerender({ delay: 500, value: true });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(true);
  });
});
