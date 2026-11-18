import { Authentication, CurrentUser, Unauthorized } from "@app/domain/account";
import type { User } from "@app/domain/account";
import { Api } from "@app/domain/api";
import { assert, it } from "@effect/vitest";
import * as Http from "alchemy/Http";
import { Effect, Layer, Ref } from "effect";
import { HttpApiTest } from "effect/http-api";

import { AccountLive } from "../src/account.ts";
import { GreetingsLive } from "../src/handlers.ts";
import * as GreetingRepo from "../src/repos/greeting.ts";

const GreetingRepoMemory = Layer.effect(
  GreetingRepo.Service,
  Effect.gen(function* () {
    const names = yield* Ref.make<readonly string[]>([]);

    return GreetingRepo.Service.of({
      record: (name) => Ref.update(names, (recorded) => [name, ...recorded]),
      listRecent: () => Ref.get(names),
    });
  })
);

const ada: User = { id: "user-1", name: "Ada", email: "ada@example.com" };

// Stand-ins for the middleware, which asks better-auth in the Worker.
const signedInAs = (user: User) =>
  Layer.succeed(Authentication, (httpEffect) =>
    Effect.provideService(httpEffect, CurrentUser, user)
  );

const signedOut = Layer.succeed(Authentication, () =>
  Effect.fail(new Unauthorized())
);

const HandlersLive = Layer.mergeAll(
  GreetingsLive.pipe(Layer.provide(GreetingRepoMemory)),
  AccountLive,
  Http.Platform
);

it.effect("greets by name", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["greetings"]);

    const greeting = yield* client.greetings.greet({ params: { name: "Ada" } });

    assert.deepStrictEqual(greeting, { message: "Hello, Ada!" });
  }).pipe(Effect.provide(HandlersLive.pipe(Layer.provideMerge(signedOut))))
);

it.effect("lists who was greeted, newest first", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["greetings"]);

    yield* client.greetings.greet({ params: { name: "Ada" } });
    yield* client.greetings.greet({ params: { name: "Grace" } });

    assert.deepStrictEqual(yield* client.greetings.listRecent(), [
      { message: "Hello, Grace!" },
      { message: "Hello, Ada!" },
    ]);
  }).pipe(Effect.provide(HandlersLive.pipe(Layer.provideMerge(signedOut))))
);

it.effect("says who is signed in", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["account"]);

    assert.deepStrictEqual(yield* client.account.me(), ada);
  }).pipe(
    Effect.provide(HandlersLive.pipe(Layer.provideMerge(signedInAs(ada))))
  )
);

it.effect("refuses a request without a session", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["account"]);

    const error = yield* Effect.flip(client.account.me());

    assert.strictEqual(error._tag, "Unauthorized");
  }).pipe(Effect.provide(HandlersLive.pipe(Layer.provideMerge(signedOut))))
);
