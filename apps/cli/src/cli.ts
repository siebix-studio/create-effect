import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import PackageJson from "../package.json" with { type: "json" };
import * as Answers from "./answers.ts";
import * as Database from "./database.ts";
import * as Git from "./git.ts";
import * as PackageManager from "./package-manager.ts";
import * as Template from "./template.ts";

const FIRST_COMMIT_MESSAGE = "Initial commit from create-effect";

const directory = Argument.Path("directory", { pathType: "directory" }).pipe(
  Argument.withDescription(
    "Where to create the project; its last segment is the project name. Asked for when omitted"
  ),
  Argument.optional
);

const database = Flag.Literals("database", Database.NAMES).pipe(
  Flag.withDescription(
    "Add a database: d1 (Cloudflare's SQLite), neon (Postgres) or none. Asked for when omitted"
  ),
  Flag.optional
);

const install = Flag.Boolean("install").pipe(
  Flag.withDescription(
    "Install dependencies with bun (--no-install to skip). Asked for when omitted"
  ),
  Flag.optional
);

const git = Flag.Boolean("git").pipe(
  Flag.withDescription(
    "Create a git repository with a first commit (--no-git to skip). Asked for when omitted"
  ),
  Flag.optional
);

const force = Flag.Boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Write into the directory even if it is not empty")
);

const yes = Flag.Boolean("yes").pipe(
  Flag.withAlias("y"),
  Flag.withDefault(false),
  Flag.withDescription(
    `Ask nothing and take every default; a missing name becomes "${Answers.DEFAULT_NAME}"`
  )
);

const done = (message: string) => Console.log(`✔ ${message}`);

const optionalStep = <E, R>(
  step: Effect.Effect<void, E, R>,
  options: {
    readonly onSuccess: string;
    readonly onFailure: (error: E) => string;
  }
) =>
  step.pipe(
    Effect.andThen(done(options.onSuccess)),
    Effect.as(true),
    Effect.catch((error) =>
      Console.error(`! ${options.onFailure(error)}`).pipe(Effect.as(false))
    )
  );

const create = Effect.fn("Cli.create")(function* (input: Answers.Input) {
  const path = yield* Path.Path;
  const repository = yield* Git.Service;
  const packageManager = yield* PackageManager.Service;

  const answers = yield* Answers.resolve(input);
  const { project } = answers;

  const relativeDirectory =
    path.relative(path.resolve(), project.directory) || ".";

  yield* Template.write(project, answers.database);
  yield* done(`Created ${project.name} in ${project.directory}`);

  // The repository exists before the install and the commit comes after it, so the first commit
  // includes the lockfile.
  const hasRepository =
    answers.git &&
    (yield* optionalStep(repository.init(project.directory), {
      onSuccess: "Initialized a git repository",
      onFailure: (error) => `Skipped git: ${error.message}.`,
    }));

  const isInstalled =
    answers.install &&
    (yield* optionalStep(packageManager.install(project.directory), {
      onSuccess: "Installed dependencies",
      onFailure: (error) => `Dependencies are not installed: ${error.message}.`,
    }));

  if (hasRepository) {
    yield* optionalStep(
      repository.commitAll(project.directory, FIRST_COMMIT_MESSAGE),
      {
        onSuccess: `Committed "${FIRST_COMMIT_MESSAGE}"`,
        onFailure: (error) =>
          `Skipped the first commit: ${error.message}. Commit once your git identity is set up.`,
      }
    );
  }

  const usesNeon = answers.database === "neon";

  yield* Console.log(
    [
      "",
      "Next steps:",
      `  cd ${relativeDirectory}`,
      ...(isInstalled ? [] : ["  bun install"]),
      // Neon has no local stand-in, so the first `bun run dev` already creates a database there.
      ...(usesNeon ? ["  bun alchemy profile edit --add Neon"] : []),
      "  bun run dev",
      "",
      "To deploy, connect Cloudflare once with `bun alchemy profile edit --add Cloudflare`,",
      "then run `bun run deploy`.",
    ].join("\n")
  );

  if (answers.prompted) {
    yield* Console.log(
      [
        "",
        "Run it again without the questions:",
        `  ${[
          `bunx ${PackageJson.name}`,
          relativeDirectory,
          `--database ${answers.database}`,
          answers.install ? "--install" : "--no-install",
          answers.git ? "--git" : "--no-git",
          ...(answers.overwrite ? ["--force"] : []),
        ].join(" ")}`,
      ].join("\n")
    );
  }
});

/**
 * The command without its services, so tests can stand in for git and the package manager.
 *
 * Like every `create-*` package, `bunx @siebix/create-effect my-app` passes the project name
 * straight to the binary, so the root command takes it instead of a `new` subcommand.
 */
export const command = Command.make("create-effect", {
  directory,
  database,
  install,
  git,
  force,
  yes,
}).pipe(
  Command.withDescription(
    "Create a full-stack Effect app on Cloudflare, deployed with Alchemy"
  ),
  Command.withExamples(({ commandPath }) => {
    const self = commandPath.join(" ");

    return [
      { command: self, description: "Answer a few questions" },
      {
        command: `${self} my-app --yes`,
        description: "Create ./my-app with every default",
      },
      {
        command: `${self} my-app --database d1`,
        description: "Create ./my-app with a D1 database",
      },
      {
        command: `${self} my-app --no-install --no-git`,
        description: "Only write the files",
      },
    ];
  }),
  Command.withHandler(create)
);

export const cli = command.pipe(
  Command.provide(Layer.mergeAll(Git.layer, PackageManager.layer))
);
