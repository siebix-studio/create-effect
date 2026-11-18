import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Database from "./database.ts";

export const NAME = "better-auth";

/** The database its Worker is written for. better-auth keeps its users and sessions there. */
export const DATABASE: Database.Database = "d1";

export class NeedsD1 extends Schema.TaggedError<
  NeedsD1,
  { readonly brand: unique symbol }
>()("NeedsD1", {
  /** What the project has instead. */
  database: Schema.Literals(Database.NAMES),
  command: Schema.Literals(["create", "add"]),
}) {
  override get [CliError.userMessage]() {
    const fix = {
      add:
        this.database === "none"
          ? "Add one first with `add d1`."
          : "This project's database is another one.",
      create: "Pass --database d1 with --better-auth.",
    }[this.command];

    return `better-auth keeps its users in a D1 database, and is not written for another one yet. ${fix} Nothing was changed.`;
  }
}

/** Fails `add better-auth` in a project without the database it builds on. */
export const checkDatabase = (
  features: readonly string[],
  requested: string
): Effect.Effect<void, NeedsD1> => {
  const database = Database.among(features) ?? "none";

  return requested === NAME && database !== DATABASE
    ? Effect.fail(new NeedsD1({ database, command: "add" }))
    : Effect.void;
};
