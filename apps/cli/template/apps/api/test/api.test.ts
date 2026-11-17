import { Api } from "@app/domain/api";
import { assert, it } from "@effect/vitest";
import * as Http from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpApiTest } from "effect/http-api";

import { GreetingsLive } from "../src/handlers.ts";

it.effect("greets by name", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(Api, ["greetings"]);

    const greeting = yield* client.greetings.greet({ params: { name: "Ada" } });

    assert.deepStrictEqual(greeting, { message: "Hello, Ada!" });
  }).pipe(Effect.provide(Layer.merge(GreetingsLive, Http.Platform)))
);
