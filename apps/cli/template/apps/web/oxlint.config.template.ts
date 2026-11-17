import foldkit from "@foldkit/oxlint-plugin";
import { defineConfig } from "oxlint";

import root from "../../oxlint.config.ts";

export default defineConfig({
  extends: [root, foldkit.configs.recommended],
  rules: {
    "typescript/array-type": ["error", { default: "generic" }],
    "no-shadow": "off",
  },
  overrides: [
    {
      // Foldkit's project organization exposes each page or feature through an
      // index.ts barrel (`export * as Home from "./home"`) that callers import
      // as a namespace (`Home.view`).
      files: ["src/**/index.ts"],
      rules: { "oxc/no-barrel-file": "off" },
    },
  ],
});
