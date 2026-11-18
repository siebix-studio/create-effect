import * as BunServices from "@effect/platform-bun/BunServices";
import { assert, describe, it } from "@effect/vitest";
import type * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as TerminalCapabilities from "effect/cli/TerminalCapabilities";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";

import { command } from "../src/cli.ts";
import * as Git from "../src/git.ts";
import * as PackageManager from "../src/package-manager.ts";
import * as Process from "../src/process.ts";
import * as ProjectRecord from "../src/project-record.ts";
import * as Project from "../src/project.ts";

const TestLayer = Layer.mergeAll(BunServices.layer, TestConsole.layer);

const run = Command.runWith(command, { version: "0.0.0" });

const unavailable = (program: string) =>
  new Process.CommandUnavailable({ command: program, cause: "not found" });

const stepLayers = (
  steps: Ref.Ref<readonly string[]>,
  failing: readonly string[] = []
) => {
  const step = (name: string) =>
    failing.includes(name)
      ? Effect.fail(unavailable(name))
      : Ref.update(steps, (taken) => [...taken, name]);

  return Layer.mergeAll(
    Layer.succeed(
      Git.Service,
      Git.Service.of({
        init: () => step("git init"),
        commitAll: () => step("git commit"),
      })
    ),
    Layer.succeed(
      PackageManager.Service,
      PackageManager.Service.of({ install: () => step("install") })
    )
  );
};

const scaffold = Effect.fn("Test.scaffold")(function* (
  args: readonly string[],
  failing: readonly string[] = []
) {
  const steps = yield* Ref.make<readonly string[]>([]);
  yield* run(args).pipe(Effect.provide(stepLayers(steps, failing)));

  return yield* Ref.get(steps);
});

const projectDirectory = Effect.fn("Test.projectDirectory")(function* (
  name: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return path.join(yield* fs.makeTempDirectoryScoped(), name);
});

const key = (name: string): Terminal.UserInput => ({
  input: Option.some(name),
  key: { name, ctrl: false, meta: false, shift: false },
});

const typed = (text: string) => Array.from(text, key);

const enter = key("enter");

const size = Effect.gen(function* () {
  const sizes = yield* Queue.make<Terminal.Size, Cause.Done>();
  yield* Queue.offer(sizes, { columns: 80, rows: 24 });

  return Queue.asDequeue(sizes);
});

const answering = (keys: readonly Terminal.UserInput[]) =>
  Layer.mergeAll(
    Layer.succeed(TerminalCapabilities.TerminalCapabilities, {
      canColor: false,
      canAnimate: false,
      canPrompt: true,
    }),
    Layer.effect(
      Terminal.Terminal,
      Effect.gen(function* () {
        const pressed = yield* Queue.make<Terminal.UserInput, Cause.Done>();
        yield* Queue.offerAll(pressed, keys);
        // Like Ctrl-C once the scripted keys run out, so a question nobody answers fails the
        // test instead of hanging it.
        yield* Queue.end(pressed);

        return Terminal.make({
          columns: Effect.succeed(80),
          rows: Effect.succeed(24),
          size,
          display: () => Effect.void,
          readInput: Effect.succeed(Queue.asDequeue(pressed)),
          readLine: Effect.succeed(""),
        });
      })
    )
  );

const listFiles = (
  directory: string,
  prefix = ""
): Effect.Effect<
  readonly string[],
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const entries = yield* fs.readDirectory(path.join(directory, prefix));

    const nested = yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry) {
        const relative = path.join(prefix, entry);
        const info = yield* fs.stat(path.join(directory, relative));

        return info.type === "Directory"
          ? yield* listFiles(directory, relative)
          : [relative];
      })
    );

    return nested.flat();
  });

describe("create-effect", () => {
  it.effect("writes the template with the project name filled in", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");

      yield* scaffold([directory]);

      const files = yield* listFiles(directory);
      assert.includeMembers(
        [...files],
        [
          ".gitignore",
          ".mcp.json",
          "package.json",
          "alchemy.run.ts",
          "apps/api/src/worker.ts",
          "apps/web/src/main.ts",
          "packages/domain/src/api.ts",
        ]
      );
      assert.notInclude(files, "gitignore");
      assert.notInclude(files, ".github/workflows/deploy.yml");
      assert.notInclude(files, "stacks/github.ts");

      const packageJson = yield* fs.readFileString(
        path.join(directory, "package.json")
      );

      assert.include(packageJson, '"name": "my-app"');

      const stack = yield* fs.readFileString(
        path.join(directory, "alchemy.run.ts")
      );

      assert.include(stack, 'Alchemy.Stack(\n  "MyApp"');
      assert.include(stack, 'workerName: "my-app-state"');

      const contents = yield* Effect.forEach(files, (file) =>
        fs.readFileString(path.join(directory, file))
      );

      assert.isFalse(
        contents.some((content) => content.includes("{{")),
        "a placeholder was left unfilled"
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("adds the deploy workflow with --github-actions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");

      const read = (file: string) =>
        fs.readFileString(path.join(directory, file));

      yield* scaffold([directory, "--github-actions"]);

      const files = yield* listFiles(directory);
      assert.includeMembers(
        [...files],
        [".github/workflows/deploy.yml", "stacks/github.ts", "alchemy.run.ts"]
      );

      // What the files should hold is read from their sources, so this test follows the
      // template's wording instead of repeating it.
      const source = (file: string) =>
        fs
          .readFileString(path.join(import.meta.dirname, "..", file))
          .pipe(
            Effect.map((content) =>
              content
                .replaceAll("{{name}}", "my-app")
                .replaceAll("{{pascalName}}", "MyApp")
            )
          );

      const overlay = "overlays/github-actions";

      // A file of the overlay replaces the template's.
      assert.strictEqual(
        yield* read("alchemy.run.ts"),
        yield* source(`${overlay}/alchemy.run.ts`)
      );
      assert.notStrictEqual(
        yield* source(`${overlay}/alchemy.run.ts`),
        yield* source("template/alchemy.run.ts")
      );

      // Its package.json is merged into the template's, and dependencies stay sorted.
      const packageJson = yield* read("package.json");
      assert.include(packageJson, '"name": "my-app"');
      assert.include(
        packageJson,
        [
          '    "@alchemy.run/frontend-frameworks": "catalog:",',
          '    "@alchemy.run/github": "catalog:",',
          '    "@alchemy.run/test": "catalog:",',
        ].join("\n")
      );
      assert.match(packageJson, /"@alchemy\.run\/github": "\^/u);

      // Its Markdown goes after the template's.
      for (const file of ["README.md", "AGENTS.md"]) {
        assert.strictEqual(
          yield* read(file),
          `${yield* source(`template/${file}`)}\n${yield* source(`${overlay}/${file}`)}`
        );
      }

      const contents = yield* Effect.forEach(files, read);
      assert.isFalse(
        // Not a bare `{{`: the workflow is full of `${{ … }}` expressions.
        contents.some((content) => /\{\{\w+\}\}/u.test(content)),
        "a placeholder was left unfilled"
      );

      const output = (yield* TestConsole.logLines).join("\n");
      assert.include(output, "stacks/github.ts");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("installs before the first commit, so it has the lockfile", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory]);

      assert.deepStrictEqual(steps, ["git init", "install", "git commit"]);

      const output = (yield* TestConsole.logLines).join("\n");
      assert.include(output, `Created my-app in ${directory}`);
      assert.include(output, "bun run dev");
      assert.notInclude(output, "bun install");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("skips the steps it is told to skip", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory, "--no-install", "--no-git"]);

      assert.deepStrictEqual(steps, []);
      assert.include((yield* TestConsole.logLines).join("\n"), "bun install");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("still creates the project when the install fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory], ["install"]);

      assert.deepStrictEqual(steps, ["git init", "git commit"]);
      assert.isTrue(yield* fs.exists(path.join(directory, "package.json")));
      assert.include(
        (yield* TestConsole.errorLines).join("\n"),
        "Dependencies are not installed"
      );
      assert.include((yield* TestConsole.logLines).join("\n"), "bun install");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("goes on without a repository when git is missing", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory], ["git init"]);

      assert.deepStrictEqual(steps, ["install"]);
      assert.include((yield* TestConsole.errorLines).join("\n"), "Skipped git");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("refuses a directory that is not empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");
      yield* fs.makeDirectory(directory);
      yield* fs.writeFileString(path.join(directory, "notes.txt"), "keep me");

      const error = yield* Effect.flip(scaffold([directory]));

      assert.strictEqual(error._tag, "DirectoryNotEmpty");
      assert.deepStrictEqual(yield* fs.readDirectory(directory), ["notes.txt"]);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("writes into a directory that is not empty with --force", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");
      yield* fs.makeDirectory(directory);
      yield* fs.writeFileString(path.join(directory, "notes.txt"), "keep me");

      yield* scaffold([directory, "--force"]);

      const files = yield* fs.readDirectory(directory);
      assert.includeMembers([...files], ["notes.txt", "package.json"]);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("rejects a name Cloudflare and npm would not accept", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* projectDirectory("My App");

      const error = yield* Effect.flip(scaffold([directory]));

      assert.strictEqual(error._tag, "InvalidProjectName");
      assert.isFalse(yield* fs.exists(directory));
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("asks for a name it cannot prompt for", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(scaffold([]));

      assert.strictEqual(error._tag, "MissingProjectName");
    }).pipe(Effect.provide(TestLayer))
  );
});

describe("the project record", () => {
  const features = Effect.fn("Test.features")(function* (directory: string) {
    const record = yield* ProjectRecord.read(directory);

    return Option.map(record, ({ features: recorded }) => recorded);
  });

  it.effect("says which features a new project has", () =>
    Effect.gen(function* () {
      const plain = yield* projectDirectory("my-app");
      const deployed = yield* projectDirectory("my-app");

      yield* scaffold([plain, "--no-install", "--no-git"]);
      yield* scaffold([
        deployed,
        "--no-install",
        "--no-git",
        "--github-actions",
      ]);

      assert.deepStrictEqual(yield* features(plain), Option.some([]));
      assert.deepStrictEqual(
        yield* features(deployed),
        Option.some(["github-actions"])
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("stops add when the project already has the feature", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");
      yield* scaffold([
        directory,
        "--github-actions",
        "--no-install",
        "--no-git",
      ]);

      const steps = yield* scaffold([
        "add",
        "github-actions",
        "--directory",
        directory,
      ]);

      assert.deepStrictEqual(steps, []);
      assert.include(
        (yield* TestConsole.logLines).join("\n"),
        "already has github-actions"
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("is written by add for a project that has none", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");
      yield* scaffold([directory, "--no-install", "--no-git"]);
      yield* fs.remove(path.join(directory, ProjectRecord.FILE));

      yield* scaffold(["add", "github-actions", "--directory", directory]);

      assert.deepStrictEqual(
        yield* features(directory),
        Option.some(["github-actions"])
      );
      assert.isTrue(
        yield* fs.exists(path.join(directory, ".github/workflows/deploy.yml"))
      );
    }).pipe(Effect.provide(TestLayer))
  );
});

describe("add", () => {
  const readAll = Effect.fn("Test.readAll")(function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files = yield* listFiles(directory);

    const contents = yield* Effect.forEach(files, (file) =>
      fs.readFileString(path.join(directory, file))
    );

    return Object.fromEntries(
      files.map((file, index) => [file, contents[index]])
    );
  });

  it.effect("turns a project into the one its flag would have created", () =>
    Effect.gen(function* () {
      const created = yield* projectDirectory("my-app");
      const added = yield* projectDirectory("my-app");
      yield* scaffold([
        created,
        "--github-actions",
        "--no-install",
        "--no-git",
      ]);
      yield* scaffold([added, "--no-install", "--no-git"]);

      const steps = yield* scaffold([
        "add",
        "github-actions",
        "--directory",
        added,
      ]);

      assert.deepStrictEqual(steps, ["install"]);
      assert.deepStrictEqual(yield* readAll(added), yield* readAll(created));
      assert.deepStrictEqual(yield* TestConsole.errorLines, []);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("changes nothing the second time", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");
      const add = ["add", "github-actions", "--directory", directory];
      yield* scaffold([directory, "--no-install", "--no-git"]);
      yield* scaffold([...add, "--no-install"]);
      const once = yield* readAll(directory);

      const steps = yield* scaffold([...add, "--no-install"]);

      assert.deepStrictEqual(steps, []);
      assert.deepStrictEqual(yield* readAll(directory), once);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("leaves a file the project's owner changed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");
      const stack = path.join(directory, "alchemy.run.ts");
      yield* scaffold([directory, "--no-install", "--no-git"]);
      const changed = `${yield* fs.readFileString(stack)}// mine\n`;
      yield* fs.writeFileString(stack, changed);

      yield* scaffold(["add", "github-actions", "--directory", directory]);

      assert.strictEqual(yield* fs.readFileString(stack), changed);
      assert.isTrue(yield* fs.exists(path.join(directory, "stacks/github.ts")));
      assert.include(
        (yield* TestConsole.errorLines).join("\n"),
        "Left alchemy.run.ts as it is"
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("refuses a directory that is not a project", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* projectDirectory("my-app");
      yield* fs.makeDirectory(directory);

      const error = yield* Effect.flip(
        scaffold(["add", "github-actions", "--directory", directory])
      );

      assert.strictEqual(error._tag, "NotAProject");
      assert.deepStrictEqual(yield* fs.readDirectory(directory), []);
    }).pipe(Effect.provide(TestLayer))
  );
});

describe("questions", () => {
  it.effect("asks for whatever the command line left open", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("shop");

      const steps = yield* scaffold([]).pipe(
        Effect.provide(
          answering([...typed(directory), enter, enter, key("n"), enter])
        )
      );

      assert.deepStrictEqual(steps, ["install"]);
      assert.isTrue(yield* fs.exists(path.join(directory, "package.json")));

      const output = (yield* TestConsole.logLines).join("\n");
      assert.include(output, "Run it again without the questions:");
      assert.include(output, "--install --no-git --no-github-actions");
      assert.isFalse(
        yield* fs.exists(path.join(directory, ".github/workflows/deploy.yml"))
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("does not ask what a flag already answered", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory, "--no-git"]).pipe(
        Effect.provide(answering([key("y"), enter]))
      );

      assert.deepStrictEqual(steps, ["install"]);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect(
    "writes the deploy workflow when its question is answered yes",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* projectDirectory("my-app");

        yield* scaffold([directory, "--no-install", "--no-git"]).pipe(
          Effect.provide(answering([key("y")]))
        );

        assert.isTrue(
          yield* fs.exists(path.join(directory, ".github/workflows/deploy.yml"))
        );
        assert.include(
          (yield* TestConsole.logLines).join("\n"),
          "--no-install --no-git --github-actions"
        );
      }).pipe(Effect.provide(TestLayer))
  );

  it.effect("asks nothing with --yes", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory, "--yes"]).pipe(
        Effect.provide(answering([]))
      );

      assert.deepStrictEqual(steps, ["git init", "install", "git commit"]);
      assert.notInclude(
        (yield* TestConsole.logLines).join("\n"),
        "Run it again"
      );
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("asks before writing into a directory that is not empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("my-app");
      yield* fs.makeDirectory(directory);
      yield* fs.writeFileString(path.join(directory, "notes.txt"), "keep me");

      const declined = yield* Effect.flip(
        scaffold([directory]).pipe(Effect.provide(answering([key("n")])))
      );

      assert.strictEqual(declined._tag, "DirectoryNotEmpty");
      assert.deepStrictEqual(yield* fs.readDirectory(directory), ["notes.txt"]);

      yield* scaffold([
        directory,
        "--no-install",
        "--no-git",
        "--no-github-actions",
      ]).pipe(Effect.provide(answering([key("y")])));
      assert.isTrue(yield* fs.exists(path.join(directory, "package.json")));
      assert.include((yield* TestConsole.logLines).join("\n"), "--force");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("writes nothing when a question is cancelled", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* projectDirectory("my-app");

      const error = yield* Effect.flip(
        scaffold([directory]).pipe(Effect.provide(answering([])))
      );

      assert.strictEqual(error._tag, "Cancelled");
      assert.isFalse(yield* fs.exists(directory));
    }).pipe(Effect.provide(TestLayer))
  );
});

describe("project names", () => {
  it.effect("names the stack after the project", () =>
    Effect.gen(function* () {
      assert.strictEqual(
        Project.stackName(yield* Project.parseName("my-app")),
        "MyApp"
      );
    })
  );

  it.effect("says what is wrong with a name", () =>
    Effect.gen(function* () {
      const tooLong = yield* Effect.flip(Project.parseName("a".repeat(41)));
      const uppercase = yield* Effect.flip(Project.parseName("MyApp"));

      assert.include(tooLong.reason, "at most 40 characters");
      assert.include(uppercase.reason, "lowercase letters");
    })
  );
});
