import { Option, Result } from "effect";
import { expect, given, role, scene, text } from "foldkit/scene";
import { fromString } from "foldkit/url";
import { expect as assert, describe, test } from "vitest";

import type { Stats } from "../../api/src/contract";
import {
  FetchUsage,
  Message,
  Model,
  UsageAsyncData,
  init,
  update,
  view,
} from "./main";
import { AppRoute } from "./route";
import { INSTALL_COMMAND, SITE_URL } from "./site";

const model = (route: AppRoute, isReducedMotion = true) =>
  Model.make({
    route,
    usage: UsageAsyncData.Loading(),
    shownProjects: 0,
    isReducedMotion,
  });

const STATS: Stats = {
  projects: 1200,
  installed: 900,
  withGit: 600,
  interactive: 300,
  features: { "github-actions": 120 },
  added: {},
  platforms: { darwin: 1080 },
  versions: { "0.3.0": 1200 },
  days: [{ day: "2026-11-18", projects: 12 }],
};

describe("init", () => {
  test("asks the API how often the CLI was used", () => {
    const { commands } = init(Option.getOrThrow(fromString(SITE_URL)));

    assert(commands).toStrictEqual([FetchUsage()]);
  });
});

describe("update", () => {
  const settled = Message.SettledFetchUsage({ result: Result.succeed(STATS) });

  test("the count runs up to the number of projects and stops there", () => {
    const loaded = update(model(AppRoute.Home(), false), settled).model;
    assert(loaded.shownProjects).toBe(0);

    const frames: Array<number> = [];
    let current = loaded;

    for (let frame = 0; frame < 120; frame += 1) {
      current = update(current, Message.TickedCountUp({ deltaTime: 16 })).model;
      frames.push(current.shownProjects);
    }

    assert(frames.toSorted((a, b) => a - b)).toStrictEqual(frames);
    assert(frames[0]).toBeGreaterThan(0);
    assert(frames.at(-1)).toBe(STATS.projects);
  });

  test("the count does not run with reduced motion", () => {
    const loaded = update(model(AppRoute.Home(), true), settled).model;

    assert(loaded.shownProjects).toBe(STATS.projects);
  });

  test("the numbers are fetched again, unless a fetch is under way", () => {
    const loading = model(AppRoute.Home());
    const loaded = update(loading, settled).model;

    assert(
      update(loading, Message.TickedRefreshUsage()).commands
    ).toBeUndefined();
    assert(update(loaded, Message.TickedRefreshUsage()).commands).toStrictEqual(
      [FetchUsage()]
    );
  });
});

describe("view", () => {
  test("the home page shows the install command and what it creates", () => {
    scene(
      { update, view },
      given(model(AppRoute.Home())),
      expect(role("heading", { name: "create-effect" })).toExist(),
      expect(text(INSTALL_COMMAND)).toExist(),
      expect(role("heading", { name: "One typed contract" })).toExist(),
      expect(role("link", { name: "View the source on GitHub" })).toExist(),
      expect(role("heading", { name: "How it is used" })).toBeAbsent()
    );
  });

  test("the home page shows how the CLI is used once the API answered", () => {
    const loaded = update(
      model(AppRoute.Home()),
      Message.SettledFetchUsage({ result: Result.succeed(STATS) })
    );

    scene(
      { update, view },
      given(loaded.model),
      expect(text("1,200 projects created so far.")).toExist(),
      expect(role("heading", { name: "How it is used" })).toExist(),
      expect(text("Installed dependencies")).toExist(),
      expect(text("75%")).toExist(),
      expect(text("Added the deploy workflow")).toExist(),
      expect(text("10%")).toExist(),
      expect(text("Ran on macOS")).toExist(),
      expect(text("90%")).toExist()
    );
  });

  test("the home page stays as it is when the API cannot be reached", () => {
    const failed = update(
      model(AppRoute.Home()),
      Message.SettledFetchUsage({
        result: Result.fail("The API could not be reached."),
      })
    );

    scene(
      { update, view },
      given(failed.model),
      expect(text(INSTALL_COMMAND)).toExist(),
      expect(role("heading", { name: "How it is used" })).toBeAbsent()
    );
  });

  test("the changelog page lists the releases", () => {
    scene(
      { update, view },
      given(model(AppRoute.Changelog())),
      expect(role("heading", { name: "Changelog" })).toExist(),
      expect(role("heading", { name: "0.1.0" })).toExist()
    );
  });

  test("an unknown path shows the not found page", () => {
    scene(
      { update, view },
      given(model(AppRoute.NotFound({ path: "/nope" }))),
      expect(role("heading", { name: "Page not found" })).toExist(),
      expect(text("Nothing lives at /nope.")).toExist()
    );
  });
});
