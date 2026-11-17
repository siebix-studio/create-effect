import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The template has test files of its own; they run inside a generated project (test/e2e.test.ts).
    include: ["test/**/*.test.ts"],
  },
});
