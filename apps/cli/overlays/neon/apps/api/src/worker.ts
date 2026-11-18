import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/sql/Postgres";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { Hyperdrive } from "./database.ts";
import { HttpLive } from "./http.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    // The Postgres driver opens its socket through Node's `net` and `tls` modules.
    compatibility: { date: "2026-08-25", flags: ["nodejs_compat"] },
  },
  Effect.gen(function* () {
    // Binding the connection is also what puts it, and the Neon project behind it, in the stack.
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(Hyperdrive);

    return {
      fetch: yield* HttpRouter.toHttpEffect(
        HttpLive.pipe(
          Layer.provide(SQL.PostgresLayer({ url: hyperdrive.connectionString }))
        )
      ),
    };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Cloudflare.Hyperdrive.ConnectBinding,
        Cloudflare.Telemetry()
      )
    )
  )
) {}
