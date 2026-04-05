import { describe, expect, it } from "vitest";

import { isInvalidRefreshTokenError } from "@/lib/auth-errors";

describe("isInvalidRefreshTokenError", () => {
  it("should return false for null and non-objects", () => {
    expect(isInvalidRefreshTokenError(null)).toBe(false);
    expect(isInvalidRefreshTokenError(undefined)).toBe(false);
    expect(isInvalidRefreshTokenError("string")).toBe(false);
    expect(isInvalidRefreshTokenError(1)).toBe(false);
  });

  it("should return true when message mentions Refresh Token", () => {
    expect(
      isInvalidRefreshTokenError({ message: "Invalid Refresh Token" })
    ).toBe(true);
  });

  it("should return true when message mentions refresh_token", () => {
    expect(
      isInvalidRefreshTokenError({ message: "bad refresh_token value" })
    ).toBe(true);
  });

  it("should return true when code mentions refresh_token", () => {
    expect(
      isInvalidRefreshTokenError({ code: "invalid_refresh_token" })
    ).toBe(true);
  });

  it("should return false for unrelated errors", () => {
    expect(isInvalidRefreshTokenError({ message: "Network error" })).toBe(
      false
    );
  });
});
