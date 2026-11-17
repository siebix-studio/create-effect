import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Test from "@alchemy.run/test/Vitest";
import { Effect } from "effect";
import { HttpClient } from "effect/http";
import { expect } from "vitest";

import Stack from "../alchemy.run.ts";

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  dev: true,
});

const stack = beforeAll(deploy(Stack));

afterAll(destroy(Stack));

test(
  "the API greets by name",
  Effect.gen(function* () {
    const { api } = yield* stack;

    const response = yield* HttpClient.get(`${api}/greetings/Ada`);

    expect(response.status).toBe(200);
    expect(yield* response.json).toStrictEqual({ message: "Hello, Ada!" });
  })
);

test(
  "the website is served",
  Effect.gen(function* () {
    const { web } = yield* stack;

    const response = yield* HttpClient.get(web);

    expect(response.status).toBe(200);
    expect(yield* response.text).toContain("{{name}}");
  })
);
