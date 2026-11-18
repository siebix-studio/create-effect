import * as Cloudflare from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { HttpRouter } from "effect/http";

import { HttpLive } from "./http.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    compatibility: { date: "2026-08-25" },
  },
  Effect.gen(function* () {
    return { fetch: yield* HttpRouter.toHttpEffect(HttpLive) };
  }).pipe(Effect.provide(Cloudflare.Telemetry()))
) {}
