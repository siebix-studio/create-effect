import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as Telemetry from "../../cli/src/telemetry.ts";

/** Counts by value, most seen first. */
export const Tally = Schema.Record(Schema.String, Schema.Int);

export type Tally = typeof Tally.Type;

export const Day = Schema.Struct({
  /** A UTC date, `2026-11-18`. */
  day: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)),
  projects: Schema.Int,
});

/** Every number but `added` counts created projects. */
export const Stats = Schema.Struct({
  projects: Schema.Int,
  installed: Schema.Int,
  withGit: Schema.Int,
  interactive: Schema.Int,
  features: Tally,
  /** Features added to an existing project. */
  added: Tally,
  platforms: Tally,
  versions: Tally,
  /** Newest first. */
  days: Schema.Array(Day),
});

export type Stats = typeof Stats.Type;

export class TooManyRequests extends Schema.TaggedError<
  TooManyRequests,
  { readonly brand: unique symbol }
>()("TooManyRequests", {}, { httpApiStatus: 429 }) {}

export const Api = HttpApi.make("api").add(
  HttpApiGroup.make("usage")
    .add(
      HttpApiEndpoint.post("record", "/events", {
        payload: Telemetry.Event,
        success: HttpApiSchema.NoContent,
        error: TooManyRequests,
      })
    )
    .add(HttpApiEndpoint.get("stats", "/stats", { success: Stats }))
);
