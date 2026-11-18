import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Test from "@alchemy.run/test/Vitest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Schema from "effect/Schema";
import { expect } from "vitest";

import Stack from "../alchemy.run.ts";
import { Stats } from "../apps/api/src/contract.ts";
import type * as Telemetry from "../apps/cli/src/telemetry.ts";

// Runs locally, as under `alchemy dev`.
const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  dev: true,
});

const stack = beforeAll(deploy(Stack));

afterAll(destroy(Stack));

type Body = Readonly<Record<string, string | boolean | readonly string[]>>;

const report = (api: string, event: Body) =>
  HttpClient.execute(
    HttpClientRequest.post(`${api}/events`).pipe(
      HttpClientRequest.bodyJsonUnsafe(event)
    )
  );

const stats = Effect.fn("Test.stats")(function* (api: string) {
  const response = yield* HttpClient.get(`${api}/stats`);
  expect(response.headers["cache-control"]).toBe("public, max-age=60");

  return yield* Schema.decodeUnknownEffect(Stats)(yield* response.json);
});

const created: Telemetry.Event = {
  command: "create",
  features: ["github-actions"],
  install: true,
  git: false,
  interactive: true,
  cliVersion: "1.2.3",
  platform: "linux",
};

test(
  "the API counts what the CLI reports",
  Effect.gen(function* () {
    const { api } = yield* stack;
    const before = yield* stats(api);

    expect((yield* report(api, created)).status).toBe(204);
    expect(
      (yield* report(api, { ...created, features: [], install: false })).status
    ).toBe(204);
    expect(
      (yield* report(api, {
        command: "add",
        features: ["github-actions"],
        install: true,
        cliVersion: "1.2.3",
        platform: "linux",
      })).status
    ).toBe(204);

    const after = yield* stats(api);

    const gained = (count: (of: Stats) => number | undefined) =>
      (count(after) ?? 0) - (count(before) ?? 0);

    expect(gained((of) => of.projects)).toBe(2);
    expect(gained((of) => of.installed)).toBe(1);
    expect(gained((of) => of.withGit)).toBe(0);
    expect(gained((of) => of.interactive)).toBe(2);
    expect(gained((of) => of.features["github-actions"])).toBe(1);
    expect(gained((of) => of.added["github-actions"])).toBe(1);
    expect(gained((of) => of.platforms.linux)).toBe(2);
    expect(gained((of) => of.versions["1.2.3"])).toBe(2);
    expect(gained((of) => of.days[0]?.projects)).toBe(2);
  })
);

test(
  "the API refuses what the CLI would not send",
  Effect.gen(function* () {
    const { api } = yield* stack;
    const before = yield* stats(api);

    const refused = yield* report(api, {
      ...created,
      platform: "a platform <script>",
    });

    expect(refused.status).toBe(400);
    expect(yield* stats(api)).toStrictEqual(before);
  })
);

test(
  "the website is served",
  Effect.gen(function* () {
    const { url } = yield* stack;

    const response = yield* HttpClient.get(url);

    expect(response.status).toBe(200);
    expect(yield* response.text).toContain("create-effect");
  })
);
