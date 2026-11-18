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

// The deploy workflow brings a stack file of its own and another alchemy.run.ts, so both shapes
// of the project are checked.
test.each([
  { name: "my-app", flags: [] },
  { name: "my-ci-app", flags: ["--github-actions"] },
])(
  "a project generated with $flags installs and passes its own checks",
  ({ name, flags }) => {
    exec("bun", [BIN, name, ...flags], workspace);

    const project = path.join(workspace, name);
    expect(existsSync(path.join(project, "bun.lock"))).toBe(true);
    expect(existsSync(path.join(project, ".git"))).toBe(true);

    exec("bun", ["run", "check"], project);
    exec("bun", ["run", "typecheck"], project);
    exec("bun", ["run", "test"], project);
  },
  5 * MINUTES
);
