import * as CliError from "effect/cli/CliError";
import type * as Prompt from "effect/cli/Prompt";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** The databases a project can have. Each is an overlay of the same name. */
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

const isDatabase = (feature: string): feature is (typeof DATABASES)[number] =>
  DATABASES.some((database) => database === feature);

/** The database among a project's features, if it has one. */
export const among = (features: readonly string[]) => features.find(isDatabase);

/** A project has one database: both write the same Worker, repository and migration. */
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

/** Fails when `requested` is a database and the project's features already hold one. */
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
