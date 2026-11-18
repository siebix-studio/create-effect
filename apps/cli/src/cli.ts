import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import PackageJson from "../package.json" with { type: "json" };
import * as Answers from "./answers.ts";
import * as Database from "./database.ts";
import * as Git from "./git.ts";
import * as PackageManager from "./package-manager.ts";
import * as ProjectRecord from "./project-record.ts";
import * as Project from "./project.ts";
import * as Telemetry from "./telemetry.ts";
import * as Template from "./template.ts";

const FIRST_COMMIT_MESSAGE = "Initial commit from create-effect";

const OVERLAY_SOURCE =
  "https://github.com/siebix-studio/create-effect/blob/main/apps/cli/overlays";

/** What is left for the user to do once an overlay's files are written. */
const OVERLAY_NEXT_STEPS: Record<Template.Overlay, readonly string[]> = {
  "github-actions": [
    "The deploy workflow needs Cloudflare credentials in GitHub. Create them once",
    'with `stacks/github.ts`; see "CI/CD" in README.md.',
  ],
  d1: [
    "The D1 database runs on your machine under `bun run dev` and `bun run test`;",
    'see "Database" in README.md.',
  ],
  neon: [
    "The database is a real Neon project, in development too. Before `bun run dev`,",
    "store a Neon API key once with `bun alchemy profile edit --add Neon`;",
    'see "Database" in README.md.',
  ],
};

const DEPLOYING_A_DATABASE = [
  "The deploy workflow does not know about the database yet. What it needs is at",
  'the end of "Database" in README.md.',
];

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

const githubActions = Flag.Boolean("github-actions").pipe(
  Flag.withDescription(
    "Add a GitHub Actions workflow that deploys main and previews each pull request (--no-github-actions to skip). It needs Cloudflare credentials in GitHub. Asked for when omitted"
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

const TELEMETRY_NOTICE = [
  "",
  "This run was counted anonymously: the options chosen, never a name or a path.",
  "DO_NOT_TRACK=1 turns that off.",
].join("\n");

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
  const telemetry = yield* Telemetry.Service;

  const answers = yield* Answers.resolve(input);
  const { project } = answers;

  const relativeDirectory =
    path.relative(path.resolve(), project.directory) || ".";

  const overlays: readonly Template.Overlay[] = [
    ...(answers.database === "none" ? [] : [answers.database]),
    ...(answers.githubActions ? (["github-actions"] as const) : []),
  ];

  yield* Template.write(project, { overlays });

  // What `add` reads later to know which features the project already has.
  yield* ProjectRecord.write(project.directory, {
    version: PackageJson.version,
    features: overlays,
  });
  yield* done(`Created ${project.name} in ${project.directory}`);

  // Runs beside the steps below.
  const reported = yield* Effect.forkChild(
    telemetry.record({
      command: "create",
      features: overlays,
      install: answers.install,
      git: answers.git,
      interactive: answers.prompted,
      cliVersion: PackageJson.version,
      platform: process.platform,
    })
  );

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

  yield* Console.log(
    [
      "",
      "Next steps:",
      `  cd ${relativeDirectory}`,
      ...(isInstalled ? [] : ["  bun install"]),
      "  bun run dev",
      "",
      "To deploy, connect Cloudflare once with `bun alchemy profile edit --add Cloudflare`,",
      "then run `bun run deploy`.",
      ...overlays.flatMap((overlay) => ["", ...OVERLAY_NEXT_STEPS[overlay]]),
      ...(overlays.length > 1 ? ["", ...DEPLOYING_A_DATABASE] : []),
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
          answers.githubActions ? "--github-actions" : "--no-github-actions",
          ...(answers.overwrite ? ["--force"] : []),
        ].join(" ")}`,
      ].join("\n")
    );
  }

  yield* Fiber.join(reported);

  if (telemetry.enabled) {
    yield* Console.log(TELEMETRY_NOTICE);
  }
});

const overlay = Argument.Literals("feature", Template.OVERLAYS).pipe(
  Argument.withDescription(
    "What to add. github-actions: the workflow that deploys main and previews each pull request. d1 or neon: a database, where the project has none"
  )
);

const projectDirectory = Flag.Directory("directory", { mustExist: true }).pipe(
  Flag.withDefault("."),
  Flag.withDescription(
    "The project to add it to; the current directory when omitted"
  )
);

const installAfterAdd = Flag.Boolean("install").pipe(
  Flag.withDefault(true),
  Flag.withDescription(
    "Install dependencies with bun afterwards (--no-install to skip)"
  )
);

const add = Effect.fn("Cli.add")(function* (input: {
  readonly overlay: Template.Overlay;
  readonly directory: string;
  readonly install: boolean;
}) {
  const path = yield* Path.Path;
  const packageManager = yield* PackageManager.Service;
  const telemetry = yield* Telemetry.Service;

  const project = yield* Project.fromExisting(path.resolve(input.directory));

  // A project from before the record existed has none. It gets one here.
  const features = Option.match(yield* ProjectRecord.read(project.directory), {
    onNone: (): readonly string[] => [],
    onSome: (record) => record.features,
  });

  if (features.includes(input.overlay)) {
    yield* done(
      `${project.name} already has ${input.overlay}. Nothing was changed.`
    );

    return;
  }

  yield* Database.checkRoom(project.name, features, input.overlay);

  const kept = yield* Template.add(project, input.overlay);

  yield* ProjectRecord.write(project.directory, {
    version: PackageJson.version,
    features: [...features, input.overlay],
  });

  yield* done(`Added ${input.overlay} to ${project.name}`);

  const reported = yield* Effect.forkChild(
    telemetry.record({
      command: "add",
      features: [input.overlay],
      install: input.install,
      cliVersion: PackageJson.version,
      platform: process.platform,
    })
  );

  // A file the project's owner changed is theirs. They are shown what it would have become.
  yield* Effect.forEach(
    kept,
    (file) =>
      Console.error(
        `! Left ${file} as it is, because it has changes of its own. Compare it with ${OVERLAY_SOURCE}/${input.overlay}/${file}`
      ),
    { discard: true }
  );

  const isInstalled =
    input.install &&
    (yield* optionalStep(packageManager.install(project.directory), {
      onSuccess: "Installed dependencies",
      onFailure: (error) => `Dependencies are not installed: ${error.message}.`,
    }));

  yield* Console.log(
    [
      "",
      ...(isInstalled
        ? []
        : ["Run `bun install` to get its dependencies.", ""]),
      ...OVERLAY_NEXT_STEPS[input.overlay],
      ...(features.length > 0 &&
      Database.among([...features, input.overlay]) !== undefined
        ? ["", ...DEPLOYING_A_DATABASE]
        : []),
    ].join("\n")
  );

  yield* Fiber.join(reported);

  if (telemetry.enabled) {
    yield* Console.log(TELEMETRY_NOTICE);
  }
});

const addCommand = Command.make("add", {
  overlay,
  directory: projectDirectory,
  install: installAfterAdd,
}).pipe(
  Command.withDescription(
    "Add a feature to a project that create-effect made earlier"
  ),
  Command.withExamples(({ commandPath }) => [
    {
      command: `${commandPath.join(" ")} github-actions`,
      description: "Add the deploy workflow to the project in this directory",
    },
    {
      command: `${commandPath.join(" ")} d1`,
      description: "Add a D1 database to it",
    },
  ]),
  Command.withHandler(add)
);

/**
 * The command without its services, so tests can stand in for git, the package manager and
 * telemetry.
 *
 * Like every `create-*` package, `bunx @siebix/create-effect my-app` passes the project name
 * straight to the binary, so the root command takes it instead of a `new` subcommand.
 */
export const command = Command.make("create-effect", {
  directory,
  database,
  install,
  git,
  githubActions,
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
      {
        command: `${self} my-app --github-actions`,
        description: "Also write the deploy workflow",
      },
    ];
  }),
  Command.withHandler(create),
  Command.withSubcommands([addCommand])
);

export const cli = command.pipe(
  Command.provide(
    Layer.mergeAll(
      Git.layer,
      PackageManager.layer,
      Telemetry.layer.pipe(Layer.provide(FetchHttpClient.layer))
    )
  )
);
