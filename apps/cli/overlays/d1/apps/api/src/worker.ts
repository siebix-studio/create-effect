import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/cloudflare/D1/SQL";
import * as Alchemy from "alchemy";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { apiRoutes } from "../../../domain.ts";
import { Database } from "./database.ts";
import { HttpLive } from "./http.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return {
      main: import.meta.url,
      compatibility: { date: "2026-08-25" },
      routes: apiRoutes(stage),
    };
  }),
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
