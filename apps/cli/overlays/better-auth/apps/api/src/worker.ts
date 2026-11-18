import { CloudflareD1 } from "@alchemy.run/better-auth/CloudflareD1";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/cloudflare/D1/SQL";
import * as Alchemy from "alchemy";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";

import { apiRoutes } from "../../../domain.ts";
import { AUTH_PATH, Auth, withWebsiteCors } from "./auth.ts";
import { Database } from "./database.ts";
import { HttpLive } from "./http.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return {
      main: import.meta.url,
      // better-auth imports Node modules, `async_hooks` among them.
      compatibility: { date: "2026-08-25", flags: ["nodejs_compat"] },
      routes: apiRoutes(stage),
    };
  }),
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(Database);
    const auth = yield* Auth;

    const api = yield* HttpRouter.toHttpEffect(
      HttpLive.pipe(Layer.provide(SQL.D1Layer(d1)))
    );

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const path = request.url.split("?")[0] ?? "";

        return yield* path === AUTH_PATH || path.startsWith(`${AUTH_PATH}/`)
          ? auth.fetch
          : api;
      }).pipe(withWebsiteCors),
    };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Auth.layer.pipe(Layer.provide(CloudflareD1(Database))),
        Cloudflare.D1.QueryDatabaseBinding,
        Cloudflare.Telemetry()
      )
    )
  )
) {}
