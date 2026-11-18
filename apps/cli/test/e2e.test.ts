import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, expect, test } from "vitest";

// Test projects are not counted.
const exec = (command: string, args: readonly string[], cwd: string) =>
  execFileSync(command, args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, DO_NOT_TRACK: "1" },
  });

const BIN = path.join(import.meta.dirname, "../src/bin.ts");

const MINUTES = 60_000;

const workspace = await mkdtemp(path.join(tmpdir(), "create-effect-"));

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

const create = (name: string, flags: readonly string[]) => {
  exec("bun", [BIN, name, ...flags], workspace);

  const project = path.join(workspace, name);
  expect(existsSync(path.join(project, "bun.lock"))).toBe(true);
  expect(existsSync(path.join(project, ".git"))).toBe(true);
  expect(existsSync(path.join(project, ".git/hooks/pre-commit"))).toBe(true);
  expect(existsSync(path.join(project, ".vscode/settings.json"))).toBe(true);

  return project;
};

// The deploy workflow brings a stack file of its own and another alchemy.run.ts, and a database
// another Worker and stack test, so each shape of the project is checked, and the two together.
test.each([
  { name: "my-app", flags: [] },
  { name: "my-ci-app", flags: ["--github-actions"] },
  { name: "my-d1-app", flags: ["--database", "d1"] },
  { name: "my-ci-d1-app", flags: ["--database", "d1", "--github-actions"] },
])(
  "a project generated with $flags installs and passes its own checks",
  ({ name, flags }) => {
    const project = create(name, flags);

    exec("bun", ["run", "check"], project);
    exec("bun", ["run", "typecheck"], project);
    exec("bun", ["run", "test"], project);
  },
  5 * MINUTES
);

// Neon has no local stand-in: the project's stack test creates a real Neon project. So that test
// only runs where Neon credentials are set, and everything else is checked regardless.
test(
  "a project generated with a Neon database installs and passes its own checks",
  () => {
    const project = create("my-neon-app", [
      "--database",
      "neon",
      "--github-actions",
    ]);

    exec("bun", ["run", "check"], project);
    exec("bun", ["run", "typecheck"], project);
    exec("bun", ["--filter", "./apps/*", "test"], project);

    if (process.env.NEON_API_KEY !== undefined) {
      exec("bunx", ["vitest", "run"], project);
    }
  },
  10 * MINUTES
);
