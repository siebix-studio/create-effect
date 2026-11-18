import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/cloudflare/D1/SQL";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { Database } from "./database.ts";
import { HttpLive } from "./http.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    compatibility: { date: "2026-08-25" },
  },
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(Database);

    return {
      fetch: yield* HttpRouter.toHttpEffect(
        HttpLive.pipe(Layer.provide(SQL.D1Layer(d1)))
      ),
    };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(Cloudflare.D1.QueryDatabaseBinding, Cloudflare.Telemetry())
    )
  )
) {}
