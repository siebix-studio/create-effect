import * as BunServices from "@effect/platform-bun/BunServices";
import { assert, it } from "@effect/vitest";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestConsole from "effect/testing/TestConsole";

import { cli } from "../src/cli.ts";

const TestLayer = Layer.mergeAll(BunServices.layer, TestConsole.layer);

const run = Command.runWith(cli, { version: "0.0.0" });

it.effect("reports the project it would create", () =>
  Effect.gen(function* () {
    yield* run(["my-app"]);

    const lines = yield* TestConsole.logLines;
    assert.deepStrictEqual(lines, [
      'Would scaffold a new project named "my-app".',
    ]);
  }).pipe(Effect.provide(TestLayer))
);
