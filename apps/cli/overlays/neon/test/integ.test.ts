import * as Test from "@alchemy.run/test/Vitest";
import { Effect } from "effect";
import { HttpClient } from "effect/http";
import { expect } from "vitest";

import Stack from "../alchemy.run.ts";
import { providers } from "../providers.ts";

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers,
  dev: true,
});

const MINUTES = 60_000;

// The Worker and the website run on this machine, but the database is a real Neon project, created
// here and deleted afterwards. That needs Neon credentials and takes a while.
const stack = beforeAll(deploy(Stack), { timeout: 4 * MINUTES });

afterAll(destroy(Stack), { timeout: 3 * MINUTES });

test(
  "the API greets by name and remembers it",
  Effect.gen(function* () {
    const { api } = yield* stack;

    const response = yield* HttpClient.get(`${api}/greetings/Ada`);

    expect(response.status).toBe(200);
    expect(yield* response.json).toStrictEqual({ message: "Hello, Ada!" });

    // Read back from the Neon database, which the migration in `migrations/` set up.
    const recent = yield* HttpClient.get(`${api}/greetings`);

    expect(recent.status).toBe(200);
    expect(yield* recent.json).toStrictEqual([{ message: "Hello, Ada!" }]);
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
