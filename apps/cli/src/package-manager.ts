import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Process from "./process.ts";

export interface Interface {
  readonly install: (
    directory: string
  ) => Effect.Effect<void, Process.CommandError>;
}

export class Service extends Context.Service<Service, Interface>()(
  "create-effect/PackageManager"
) {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const run = yield* Process.runner;

    const install = Effect.fn("PackageManager.install")(function* (
      directory: string
    ) {
      yield* run("bun", ["install"], { cwd: directory, output: "inherit" });
    });

    return Service.of({ install });
  })
);
