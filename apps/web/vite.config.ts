import { foldkit } from "@foldkit/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    foldkit({
      // Every page is prerendered at build time (SSG) and hydrated in the browser.
      ssr: {
        serverEntry: "/src/entry.server.ts",
        clientEntry: "/src/entry.ts",
        build: { prerender: true },
      },
    }),
  ],
  optimizeDeps: {
    entries: ["src/entry.ts"],
  },
});
