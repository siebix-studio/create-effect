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

test(
  "a generated project installs and passes its own checks",
  () => {
    exec("bun", [BIN, "my-app"], workspace);

    const project = path.join(workspace, "my-app");
    expect(existsSync(path.join(project, "bun.lock"))).toBe(true);
    expect(existsSync(path.join(project, ".git"))).toBe(true);

    exec("bun", ["run", "check"], project);
    exec("bun", ["run", "typecheck"], project);
    exec("bun", ["run", "test"], project);
  },
  5 * MINUTES
);
