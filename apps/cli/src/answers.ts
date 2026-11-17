import * as CliError from "effect/cli/CliError";
import * as Prompt from "effect/cli/Prompt";
import * as TerminalCapabilities from "effect/cli/TerminalCapabilities";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";

import * as Database from "./database.ts";
import * as Project from "./project.ts";
import * as Template from "./template.ts";

export const DEFAULT_NAME = "my-app";

const INTERRUPTED_EXIT_CODE = 130;

export class MissingProjectName extends Schema.TaggedError<
  MissingProjectName,
  { readonly brand: unique symbol }
>()("MissingProjectName", {}) {
  override readonly [CliError.userMessage] = `Pass a project name, or --yes to call it "${DEFAULT_NAME}".`;
}

export class Cancelled extends Schema.TaggedError<
  Cancelled,
  { readonly brand: unique symbol }
>()("Cancelled", {}) {
  override readonly [CliError.userMessage] = "Cancelled. Nothing was written.";
  override readonly [Runtime.errorExitCode] = INTERRUPTED_EXIT_CODE;
}

/** What the command line said. `None` is a question still open. */
export interface Input {
  readonly directory: Option.Option<string>;
  readonly database: Option.Option<Database.Database>;
  readonly install: Option.Option<boolean>;
  readonly git: Option.Option<boolean>;
  readonly force: boolean;
  readonly yes: boolean;
}

export interface Answers {
  readonly project: Project.Project;
  readonly database: Database.Database;
  readonly install: boolean;
  readonly git: boolean;
  /** The directory had files and the user chose to write into it anyway. */
  readonly overwrite: boolean;
  /** At least one answer came from a prompt instead of the command line. */
  readonly prompted: boolean;
}

const ask = <A>(prompt: Prompt.Prompt<A>) =>
  Prompt.run(prompt).pipe(Effect.mapError(() => new Cancelled()));

/**
 * Settles every open question. In a terminal each one is asked; with `--yes`, or where nothing can
 * be asked (CI, a pipe), each takes its default, except the project name, which has to be given.
 */
export const resolve = Effect.fn("Answers.resolve")(function* (input: Input) {
  const path = yield* Path.Path;
  const { canPrompt } = yield* TerminalCapabilities.TerminalCapabilities;
  const interactive = canPrompt && !input.yes;

  const confirm = (
    flag: Option.Option<boolean>,
    message: string,
    initial: boolean
  ) =>
    Option.match(flag, {
      onNone: () =>
        interactive
          ? ask(Prompt.Confirm({ message, initial }))
          : Effect.succeed(initial),
      onSome: Effect.succeed,
    });

  const askDirectory = Effect.gen(function* () {
    if (input.yes) {
      return path.resolve(DEFAULT_NAME);
    }

    if (!canPrompt) {
      return yield* new MissingProjectName();
    }

    // The prompt's own `default` is prefilled text the user would have to erase before typing, so
    // the default is taken from an empty answer instead.
    const name = yield* ask(
      Prompt.String({
        message: `Project name (${DEFAULT_NAME})`,
        validate: (value) => {
          const answer = value.trim() || DEFAULT_NAME;

          return Project.parseName(path.basename(answer)).pipe(
            Effect.as(answer),
            Effect.mapError((error) => error.reason)
          );
        },
      })
    );

    return path.resolve(name);
  });

  const directory = yield* Option.match(input.directory, {
    onNone: () => askDirectory,
    onSome: Effect.succeed,
  });

  const project = yield* Project.fromDirectory(directory);

  const isOccupied =
    !input.force && !(yield* Template.isEmpty(project.directory));

  const overwrite =
    isOccupied &&
    interactive &&
    (yield* ask(
      Prompt.Confirm({
        message: `${project.directory} is not empty. Write into it anyway?`,
        initial: false,
      })
    ));

  if (isOccupied && !overwrite) {
    return yield* new Template.DirectoryNotEmpty({
      directory: project.directory,
    });
  }

  const database = yield* Option.match(input.database, {
    onNone: () =>
      interactive
        ? ask(
            Prompt.Select({
              message: "Add a database?",
              choices: Database.CHOICES,
            })
          )
        : Effect.succeed(Database.DEFAULT),
    onSome: Effect.succeed,
  });

  const install = yield* confirm(
    input.install,
    "Install dependencies with bun?",
    true
  );

  const git = yield* confirm(input.git, "Initialize a git repository?", true);

  return {
    project,
    database,
    install,
    git,
    overwrite,
    prompted:
      interactive &&
      (overwrite ||
        Option.isNone(input.directory) ||
        Option.isNone(input.database) ||
        Option.isNone(input.install) ||
        Option.isNone(input.git)),
  } satisfies Answers;
});
