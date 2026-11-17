import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const RECENT_LIMIT = 10;

export class PersistenceError extends Schema.TaggedError<
  PersistenceError,
  { readonly brand: unique symbol }
>()("GreetingRepo.PersistenceError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface Interface {
  readonly record: (name: string) => Effect.Effect<void, PersistenceError>;
  /** The names greeted last, newest first. */
  readonly listRecent: Effect.Effect<readonly string[], PersistenceError>;
}

export class Service extends Context.Service<Service, Interface>()(
  "@app/api/GreetingRepo"
) {}

const Row = Schema.Struct({ name: Schema.String });

// The SQL is written against `SqlClient`, not a driver. The Worker decides which database it runs on.
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const _listRecent = SqlSchema.findAll({
      Request: Schema.Void,
      Result: Row,
      execute: () =>
        sql`SELECT name FROM greetings ORDER BY id DESC LIMIT ${RECENT_LIMIT}`,
    });

    const record = Effect.fn("GreetingRepo.record")(
      function* (name: string) {
        yield* sql`INSERT INTO greetings (name) VALUES (${name})`;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            SqlError: (cause) =>
              PersistenceError.make({
                operation: "GreetingRepo.record",
                cause,
              }),
          })
        )
    );

    const listRecent = _listRecent().pipe(
      Effect.map((rows) => rows.map((row) => row.name)),
      Effect.catchTags({
        SqlError: (cause) =>
          PersistenceError.make({
            operation: "GreetingRepo.listRecent",
            cause,
          }),
        SchemaError: (cause) =>
          PersistenceError.make({
            operation: "GreetingRepo.listRecent",
            cause,
          }),
      }),
      Effect.withSpan("GreetingRepo.listRecent")
    );

    return Service.of({ record, listRecent });
  })
);
