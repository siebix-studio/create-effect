import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Array from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import type * as Telemetry from "../../cli/src/telemetry.ts";
import type * as Contract from "./contract.ts";

// Relative to the repository root, where Alchemy runs.
const MIGRATIONS = "./apps/api/migrations";

const SHOWN_VALUES = 12;
const SHOWN_DAYS = 30;

export interface Row {
  readonly [column: string]: string | number;
  readonly dimension: string;
  readonly value: string;
  readonly count: number;
}

type Counter = readonly [dimension: string, value: string];

/** The counters an event adds to. An `add` is not a project, so it only counts as `added`. */
export const countersOf = (
  event: Telemetry.Event,
  day: string
): readonly Counter[] => {
  if (event.command === "add") {
    return Array.map(event.features, (feature) => ["added", feature]);
  }

  return [
    ["projects", "all"],
    ["day", day],
    ["platform", event.platform],
    ["version", event.cliVersion],
    ...Array.map(event.features, (feature): Counter => ["feature", feature]),
    ...(event.install ? [["answer", "install"] as const] : []),
    ...(event.git ? [["answer", "git"] as const] : []),
    ...(event.interactive ? [["answer", "interactive"] as const] : []),
  ];
};

const byCountDescending = Order.mapInput(
  Order.flip(Order.Number),
  (row: Row) => row.count
);

export const statsOf = (
  rows: readonly Row[],
  days: readonly Row[]
): Contract.Stats => {
  const count = (dimension: string, value: string) =>
    Option.match(
      Array.findFirst(
        rows,
        (row) => row.dimension === dimension && row.value === value
      ),
      { onNone: () => 0, onSome: (row) => row.count }
    );

  const tally = (dimension: string): Contract.Tally =>
    Object.fromEntries(
      rows
        .filter((row) => row.dimension === dimension)
        .toSorted(byCountDescending)
        .slice(0, SHOWN_VALUES)
        .map((row) => [row.value, row.count])
    );

  return {
    projects: count("projects", "all"),
    installed: count("answer", "install"),
    withGit: count("answer", "git"),
    interactive: count("answer", "interactive"),
    features: tally("feature"),
    added: tally("added"),
    platforms: tally("platform"),
    versions: tally("version"),
    days: Array.map(days, (row) => ({ day: row.value, projects: row.count })),
  };
};

/** Counts what the CLI reports, in a single instance. */
export default class Usage extends Cloudflare.DurableObject<Usage>()(
  "Usage",
  Effect.gen(function* () {
    const migrations = yield* Cloudflare.SqlMigrations(MIGRATIONS);
    const state = yield* Cloudflare.DurableObjectState;

    // The inner Effect runs each time the instance wakes up.
    // @effect-diagnostics-next-line returnEffectInGen:off
    return Effect.gen(function* () {
      yield* migrations.apply().pipe(Effect.orDie);

      const { sql } = state.storage;

      const record = Effect.fn("Usage.record")(function* (
        event: Telemetry.Event
      ) {
        const now = yield* DateTime.now;

        yield* state.storage
          .transaction(
            Effect.gen(function* () {
              yield* Effect.asVoid(
                sql.exec(
                  "INSERT INTO events (received_at, body) VALUES (?, ?)",
                  DateTime.toEpochMillis(now),
                  JSON.stringify(event)
                )
              );

              yield* Effect.forEach(
                countersOf(event, DateTime.formatIsoDateUtc(now)),
                ([dimension, value]) =>
                  sql.exec(
                    `INSERT INTO tallies (dimension, value, count) VALUES (?, ?, 1)
                     ON CONFLICT (dimension, value) DO UPDATE SET count = count + 1`,
                    dimension,
                    value
                  ),
                { discard: true }
              );
            })
          )
          .pipe(Effect.orDie);
      });

      const stats = Effect.fn("Usage.stats")(function* () {
        const rows = yield* sql
          .exec<Row>(
            "SELECT dimension, value, count FROM tallies WHERE dimension != 'day'"
          )
          .pipe(Effect.flatMap((cursor) => cursor.toArray()));

        const days = yield* sql
          .exec<Row>(
            `SELECT dimension, value, count FROM tallies WHERE dimension = 'day'
             ORDER BY value DESC LIMIT ?`,
            SHOWN_DAYS
          )
          .pipe(Effect.flatMap((cursor) => cursor.toArray()));

        return statsOf(rows, days);
      });

      return { record, stats };
    });
  })
) {}
