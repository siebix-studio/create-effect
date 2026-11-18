import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Http from "alchemy/Http";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";

import { apiDomain, isLocal } from "../../../domain.ts";
import { Api as Contract, TooManyRequests } from "./contract.ts";
import Usage from "./usage.ts";

const EVERYTHING = "everything";

/** Per IP address. */
const REPORTS_PER_MINUTE = 20;

/** How long Cloudflare and browsers may answer `/stats` without asking the Worker. */
const STATS_MAX_AGE_SECONDS = 60;

const OK = 200;

/** Unique within the Cloudflare account. */
const THROTTLE_NAMESPACE = 7310;

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    const props = {
      main: import.meta.url,
      compatibility: { date: "2026-08-25" },
      // No per-request logs, so nothing about who sent a request is kept.
      observability: {
        enabled: true,
        logs: { enabled: true, invocationLogs: false },
      },
    };

    return isLocal(stage)
      ? props
      : { ...props, domain: apiDomain(stage), workersDev: false };
  }),
  Effect.gen(function* () {
    const usage = yield* Usage;

    // Cacheable responses are answered from the edge, without running the Worker.
    yield* Cloudflare.cache();

    const throttle = yield* Cloudflare.RateLimit("Throttle", {
      namespaceId: THROTTLE_NAMESPACE,
      simple: { limit: REPORTS_PER_MINUTE, period: 60 },
    });

    const handlers = HttpApiBuilder.group(Contract, "usage", (group) =>
      group.handleAll({
        record: Effect.fn("Api.record")(function* ({ payload, request }) {
          const { success } = yield* (
            throttle
              .limit({ key: request.headers["cf-connecting-ip"] ?? "unknown" })
              // Fail open.
              .pipe(Effect.orElseSucceed(() => ({ success: true })))
          );

          if (!success) {
            return yield* new TooManyRequests();
          }

          return yield* usage.getByName(EVERYTHING).record(payload);
        }),
        stats: Effect.fn("Api.stats")(function* () {
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              response.status === OK
                ? HttpServerResponse.setHeader(
                    response,
                    "Cache-Control",
                    `public, max-age=${STATS_MAX_AGE_SECONDS}`
                  )
                : response
            )
          );

          return yield* usage.getByName(EVERYTHING).stats();
        }),
      })
    );

    const http = HttpApiBuilder.layer(Contract).pipe(
      Layer.provide(handlers),
      Layer.provide(Http.Platform),
      // The website is another origin, and the numbers are public.
      Layer.provide(
        HttpRouter.cors({
          allowedOrigins: ["*"],
          allowedMethods: ["GET", "POST", "OPTIONS"],
          allowedHeaders: ["Content-Type"],
        })
      )
    );

    return { fetch: yield* HttpRouter.toHttpEffect(http) };
  }).pipe(Effect.provide(Cloudflare.Workers.RateLimitBinding))
) {}
