import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

const name = Argument.String("name").pipe(
  Argument.withDescription("Name of the project to create")
);

const create = Effect.fn("Cli.create")(function* (options: {
  readonly name: string;
}) {
  // Placeholder until the templates exist: report what would be created.
  yield* Console.log(`Would scaffold a new project named "${options.name}".`);
});

// Like every `create-*` package, `bunx @siebix/create-effect my-app` passes the project name
// straight to the binary, so the root command takes it instead of a `new` subcommand.
export const cli = Command.make("create-effect", { name }).pipe(
  Command.withDescription(
    "Create a full-stack Effect app on Cloudflare, deployed with Alchemy"
  ),
  Command.withHandler(create)
);
