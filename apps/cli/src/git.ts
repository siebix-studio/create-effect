import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Process from "./process.ts";

export interface Interface {
  readonly init: (
    directory: string
  ) => Effect.Effect<void, Process.CommandError>;
  readonly commitAll: (
    directory: string,
    message: string
  ) => Effect.Effect<void, Process.CommandError>;
}

export class Service extends Context.Service<Service, Interface>()(
  "create-effect/Git"
) {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const run = yield* Process.runner;

    const init = Effect.fn("Git.init")(function* (directory: string) {
      yield* run("git", ["init", "--quiet"], {
        cwd: directory,
        output: "ignore",
      });
    });

    const commitAll = Effect.fn("Git.commitAll")(function* (
      directory: string,
      message: string
    ) {
      yield* run("git", ["add", "--all"], { cwd: directory, output: "ignore" });
      yield* run(
        "git",
        ["commit", "--quiet", "--no-verify", "--message", message],
        {
          cwd: directory,
          output: "ignore",
        }
      );
    });

    return Service.of({ init, commitAll });
  })
);
