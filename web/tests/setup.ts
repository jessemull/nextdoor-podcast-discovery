import "@testing-library/jest-dom";
import { vi } from "vitest";

// Suppress expected error/warn output during tests (API logError, hook catch blocks, etc.)
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

// Allow server-only to be loaded from API route tests (Vitest runs in single context)
vi.mock("server-only", () => ({}));

// Mock IntersectionObserver for infinite scroll tests
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;
