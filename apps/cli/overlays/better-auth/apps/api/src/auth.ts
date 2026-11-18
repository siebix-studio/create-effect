import { BetterAuth } from "@alchemy.run/better-auth";
import { Authentication, CurrentUser, Unauthorized } from "@app/domain/account";
import { RuntimeContext } from "alchemy";
import { Context, Effect, Layer } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/http";
import type { HttpServerResponse } from "effect/http";

/** Where better-auth serves its own routes: sign-up, sign-in, sign-out and the session. */
export const AUTH_PATH = "/api/auth";

const WORKERS_DEV = ".workers.dev";

const hostnameOf = (url: string): string | undefined =>
  URL.canParse(url) ? new URL(url).hostname : undefined;

/** `.<account>.workers.dev` of a Worker's hostname. */
const accountOf = (hostname: string): string =>
  hostname.slice(hostname.indexOf("."));

/**
 * Whether an origin is the website that belongs to this API. That is the API's own host (one
 * origin on a domain, another port on localhost) or, on workers.dev, another Worker of the same
 * account: `web.<account>.workers.dev` next to `api.<account>.workers.dev`.
 */
export const isOwnWebsite = (origin: string, host: string): boolean => {
  const website = hostnameOf(origin);
  const api = hostnameOf(`http://${host}`);

  if (website === undefined || api === undefined) {
    return false;
  }

  return (
    website === api ||
    (api.endsWith(WORKERS_DEV) &&
      accountOf(api) !== WORKERS_DEV &&
      accountOf(website) === accountOf(api))
  );
};

const makeAuth = BetterAuth({
  basePath: AUTH_PATH,
  emailAndPassword: { enabled: true },
  // better-auth refuses a sign-in posted from an origin it does not trust.
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin") ?? "";
    const host = request?.headers.get("host") ?? "";

    return isOwnWebsite(origin, host) ? [origin] : [];
  },
});

/** better-auth, with its tables in the API's database. */
// Its calls run in the Worker that serves the request, which is what `RuntimeContext` stands for.
// oxlint-disable-next-line effecttsgo/leaking-requirements
export class Auth extends Context.Service<
  Auth,
  Effect.Success<typeof makeAuth>
>()("api/Auth") {
  static readonly layer = Layer.effect(Auth, makeAuth);
}

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth;

    return (httpEffect) =>
      Effect.gen(function* () {
        // A session that cannot be looked up is a failing database: a defect (a 500), not a 401.
        const session = yield* auth.getSession().pipe(Effect.orDie);

        if (session === null) {
          return yield* new Unauthorized();
        }

        yield* Effect.annotateCurrentSpan("user.id", session.user.id);

        return yield* Effect.provideService(httpEffect, CurrentUser, {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        });
      }).pipe(
        Effect.withSpan("authenticate"),
        Effect.provide(RuntimeContext.phantom)
      );
  })
);

/**
 * Lets the website call with its session cookie from another origin, which it is on workers.dev
 * and under `bun run dev`. It covers better-auth's routes and the API's own.
 */
export const withWebsiteCors = <E, R>(
  httpEffect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const host = request.headers.host ?? "";

    return yield* HttpMiddleware.cors({
      allowedOrigins: (origin) => isOwnWebsite(origin, host),
      allowedMethods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      credentials: true,
    })(httpEffect);
  });
