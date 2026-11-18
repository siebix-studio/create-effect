import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import { Effect } from "effect";
import { HttpRouter } from "effect/http";

import { apiRoutes } from "../../../domain.ts";
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
    return { fetch: yield* HttpRouter.toHttpEffect(HttpLive) };
  }).pipe(Effect.provide(Cloudflare.Telemetry()))
) {}
