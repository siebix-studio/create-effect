import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each app in apps/ has its own tests.
    include: ["test/**/*.test.ts"],
  },
});
