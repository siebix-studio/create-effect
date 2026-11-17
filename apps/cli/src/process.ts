import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";

export class CommandUnavailable extends Schema.TaggedError<
  CommandUnavailable,
  { readonly brand: unique symbol }
>()("CommandUnavailable", { command: Schema.String, cause: Schema.Defect() }) {
  override get message() {
    return `could not run "${this.command}"`;
  }
}

export class CommandFailed extends Schema.TaggedError<
  CommandFailed,
  { readonly brand: unique symbol }
>()("CommandFailed", { command: Schema.String, exitCode: Schema.Int }) {
  override get message() {
    return `"${this.command}" exited with status ${this.exitCode}`;
  }
}

export type CommandError = CommandUnavailable | CommandFailed;

export interface RunOptions {
  readonly cwd: string;
  readonly output: "inherit" | "ignore";
}

export const runner = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  return Effect.fn("Process.run")(function* (
    program: string,
    args: readonly string[],
    options: RunOptions
  ) {
    const command = [program, ...args].join(" ");

    yield* spawner
      .exitCode(
        ChildProcess.make(program, args, {
          cwd: options.cwd,
          stdin: "ignore",
          stdout: options.output,
          stderr: options.output,
        })
      )
      .pipe(
        Effect.mapError((cause) => new CommandUnavailable({ command, cause })),
        Effect.filterOrFail(
          (exitCode) => exitCode === 0,
          (exitCode) => new CommandFailed({ command, exitCode })
        )
      );
  });
});
