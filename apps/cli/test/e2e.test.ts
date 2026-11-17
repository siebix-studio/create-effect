import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, expect, test } from "vitest";

const exec = (command: string, args: readonly string[], cwd: string) =>
  execFileSync(command, args, { cwd, stdio: "pipe" });

const BIN = path.join(import.meta.dirname, "../src/bin.ts");

const MINUTES = 60_000;

const workspace = await mkdtemp(path.join(tmpdir(), "create-effect-"));

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

const create = (name: string, args: readonly string[]) => {
  exec("bun", [BIN, name, ...args], workspace);

  const project = path.join(workspace, name);
  expect(existsSync(path.join(project, "bun.lock"))).toBe(true);
  expect(existsSync(path.join(project, ".git"))).toBe(true);

  return project;
};

test.each([
  ["without a database", "plain", []],
  ["with a D1 database", "with-d1", ["--database", "d1"]],
])(
  "a project generated %s installs and passes its own checks",
  (_description, name, args) => {
    const project = create(name, args);

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
    const project = create("with-neon", ["--database", "neon"]);

    exec("bun", ["run", "check"], project);
    exec("bun", ["run", "typecheck"], project);
    exec("bun", ["--filter", "./apps/*", "test"], project);

    if (process.env.NEON_API_KEY !== undefined) {
      exec("bunx", ["vitest", "run"], project);
    }
  },
  10 * MINUTES
);
