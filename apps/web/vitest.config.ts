import { markdown } from "@foldkit/markdown/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The same plugin as the app build, so tests compile the changelog the way the site does.
  plugins: [markdown()],
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    environment: "happy-dom",
    setupFiles: ["./src/vitest-setup.ts"],
    server: {
      deps: {
        inline: ["foldkit", "@foldkit/devtools", "@foldkit/markdown"],
      },
    },
  },
});
