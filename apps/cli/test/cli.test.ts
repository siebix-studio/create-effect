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
          "package.json",
          "alchemy.run.ts",
          "apps/api/src/worker.ts",
          "apps/web/src/main.ts",
          "packages/domain/src/api.ts",
        ]
      );
      assert.notInclude(files, "gitignore");

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

describe("questions", () => {
  it.effect("asks for whatever the command line left open", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* projectDirectory("shop");

      const steps = yield* scaffold([]).pipe(
        Effect.provide(answering([...typed(directory), enter, enter, key("n")]))
      );

      assert.deepStrictEqual(steps, ["install"]);
      assert.isTrue(yield* fs.exists(path.join(directory, "package.json")));

      const output = (yield* TestConsole.logLines).join("\n");
      assert.include(output, "Run it again without the questions:");
      assert.include(output, "--install --no-git");
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect("does not ask what a flag already answered", () =>
    Effect.gen(function* () {
      const directory = yield* projectDirectory("my-app");

      const steps = yield* scaffold([directory, "--no-git"]).pipe(
        Effect.provide(answering([key("y")]))
      );

      assert.deepStrictEqual(steps, ["install"]);
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

      yield* scaffold([directory, "--no-install", "--no-git"]).pipe(
        Effect.provide(answering([key("y")]))
      );
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
