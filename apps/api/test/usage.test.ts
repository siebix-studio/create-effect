import { assert, describe, it } from "@effect/vitest";

import type * as Telemetry from "../../cli/src/telemetry.ts";
import { countersOf, statsOf } from "../src/usage.ts";
import type { Row } from "../src/usage.ts";

const DAY = "2026-11-18";

const created: Telemetry.Event = {
  command: "create",
  features: ["github-actions"],
  install: true,
  git: false,
  interactive: true,
  cliVersion: "0.3.0",
  platform: "darwin",
};

const row = (dimension: string, value: string, count: number): Row => ({
  dimension,
  value,
  count,
});

describe("countersOf", () => {
  it("counts a created project towards its day and each of its answers", () => {
    assert.deepStrictEqual(countersOf(created, DAY), [
      ["projects", "all"],
      ["day", DAY],
      ["platform", "darwin"],
      ["version", "0.3.0"],
      ["feature", "github-actions"],
      ["answer", "install"],
      ["answer", "interactive"],
    ]);
  });

  it("does not count an added feature as a project", () => {
    assert.deepStrictEqual(
      countersOf(
        {
          command: "add",
          features: ["github-actions"],
          install: true,
          cliVersion: "0.3.0",
          platform: "darwin",
        },
        DAY
      ),
      [["added", "github-actions"]]
    );
  });
});

describe("statsOf", () => {
  it("is all zeros before the first project", () => {
    assert.deepStrictEqual(statsOf([], []), {
      projects: 0,
      installed: 0,
      withGit: 0,
      interactive: 0,
      features: {},
      added: {},
      platforms: {},
      versions: {},
      days: [],
    });
  });

  it("groups the counters, most seen first", () => {
    const stats = statsOf(
      [
        row("projects", "all", 10),
        row("answer", "install", 8),
        row("answer", "git", 6),
        row("platform", "linux", 3),
        row("platform", "darwin", 7),
        row("feature", "github-actions", 4),
        row("added", "github-actions", 2),
        row("version", "0.3.0", 10),
      ],
      [row("day", DAY, 4), row("day", "2026-11-17", 6)]
    );

    assert.deepStrictEqual(stats, {
      projects: 10,
      installed: 8,
      withGit: 6,
      interactive: 0,
      features: { "github-actions": 4 },
      added: { "github-actions": 2 },
      platforms: { darwin: 7, linux: 3 },
      versions: { "0.3.0": 10 },
      days: [
        { day: DAY, projects: 4 },
        { day: "2026-11-17", projects: 6 },
      ],
    });
    assert.deepStrictEqual(Object.keys(stats.platforms), ["darwin", "linux"]);
  });

  it("leaves out what was seldom seen", () => {
    const versions = Array.from({ length: 40 }, (_, index) =>
      row("version", `0.0.${index}`, index + 1)
    );

    const shown = Object.keys(statsOf(versions, []).versions);

    assert.lengthOf(shown, 12);
    assert.strictEqual(shown[0], "0.0.39");
  });
});
