import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    coverage: {
      exclude: [
        "**/*.config.{js,ts,mjs}",
        "**/*.d.ts",
        "**/database.types.ts",
        "coverage/**",
        "node_modules/**",
        "tests/**",
      ],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "middleware.ts",
      ],
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
    },
    environment: "jsdom",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
