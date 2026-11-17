import type * as Prompt from "effect/cli/Prompt";

export const NAMES = ["none", "d1", "neon"] as const;

export type Database = (typeof NAMES)[number];

export const DEFAULT: Database = "none";

export const CHOICES: readonly Prompt.SelectChoice<Database>[] = [
  { title: "No database", value: "none" },
  {
    title: "D1",
    value: "d1",
    description: "Cloudflare's SQLite. Runs on your machine in dev and tests",
  },
  {
    title: "Neon",
    value: "neon",
    description:
      "Postgres behind Hyperdrive. Needs a Neon account, also in dev",
  },
];

/**
 * The directories under `overlays/` written on top of the template, in order. Both databases share
 * the endpoint that reads what was stored and the repository behind it; each adds its own
 * resources, migration and Worker.
 */
export const overlays = (database: Database): readonly string[] =>
  database === "none" ? [] : ["database", database];
