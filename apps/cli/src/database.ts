import * as CliError from "effect/cli/CliError";
import type * as Prompt from "effect/cli/Prompt";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const DATABASES = ["d1", "neon"] as const;

export const NAMES = ["none", ...DATABASES] as const;

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

const isDatabase = Schema.is(Schema.Literals(DATABASES));

export const among = (features: readonly string[]) => features.find(isDatabase);

/** Both databases write the same Worker, repository and migration, so a project has one. */
export class AlreadyPresent extends Schema.TaggedError<
  AlreadyPresent,
  { readonly brand: unique symbol }
>()("AlreadyPresent", {
  project: Schema.String,
  present: Schema.String,
  requested: Schema.String,
}) {
  override get [CliError.userMessage]() {
    return `${this.project} already has ${this.present} as its database, so ${this.requested} was not added. Nothing was changed.`;
  }
}

export const checkRoom = (
  project: string,
  features: readonly string[],
  requested: string
): Effect.Effect<void, AlreadyPresent> => {
  const present = among(features);

  return present !== undefined && isDatabase(requested)
    ? Effect.fail(new AlreadyPresent({ project, present, requested }))
    : Effect.void;
};
