import { Api } from "@app/domain/api";
import { assert, it } from "@effect/vitest";
import * as Http from "alchemy/Http";
import { Effect, Layer, Ref } from "effect";
import { HttpApiTest } from "effect/http-api";

import { GreetingsLive } from "../src/handlers.ts";
import * as GreetingRepo from "../src/repos/greeting.ts";

// Stands in for the database, so these tests are about the handlers. `test/integ.test.ts` at the
// root runs the real SQL.
const GreetingRepoMemory = Layer.effect(
  GreetingRepo.Service,
  Effect.gen(function* () {
    const names = yield* Ref.make<readonly string[]>([]);

    return GreetingRepo.Service.of({
      record: (name) => Ref.update(names, (recorded) => [name, ...recorded]),
      listRecent: Ref.get(names),
    });
  })
);

const TestLayer = Layer.merge(
  GreetingsLive.pipe(Layer.provide(GreetingRepoMemory)),
  Http.Platform
);

it.effect("greets by name", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["greetings"]);

    const greeting = yield* client.greetings.greet({ params: { name: "Ada" } });

    assert.deepStrictEqual(greeting, { message: "Hello, Ada!" });
  }).pipe(Effect.provide(TestLayer))
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
  }).pipe(Effect.provide(TestLayer))
);
