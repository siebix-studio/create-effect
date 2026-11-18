import * as Test from "@alchemy.run/test/Vitest";
import { Effect } from "effect";
import { Cookies, HttpClient, HttpClientRequest } from "effect/http";
import { expect } from "vitest";

import Stack from "../alchemy.run.ts";
import { providers } from "../providers.ts";

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers,
  dev: true,
});

const stack = beforeAll(deploy(Stack));

afterAll(destroy(Stack));

test(
  "the API greets by name and remembers it",
  Effect.gen(function* () {
    const { api } = yield* stack;

    const response = yield* HttpClient.get(`${api}/api/greetings/Ada`);

    expect(response.status).toBe(200);
    expect(yield* response.json).toStrictEqual({ message: "Hello, Ada!" });

    const recent = yield* HttpClient.get(`${api}/api/greetings`);

    expect(recent.status).toBe(200);
    expect(yield* recent.json).toStrictEqual([{ message: "Hello, Ada!" }]);
  })
);

const account = {
  name: "Ada",
  email: "ada@example.com",
  password: "correct horse battery staple",
};

test(
  "someone who signs up is who the API says they are",
  Effect.gen(function* () {
    const { api, web } = yield* stack;
    const website = new URL(web).origin;

    const anonymous = yield* HttpClient.get(`${api}/api/me`);

    expect(anonymous.status).toBe(401);

    // As the browser posts it from the website, which is another origin here.
    const signedUp = yield* HttpClient.execute(
      HttpClientRequest.post(`${api}/api/auth/sign-up/email`).pipe(
        HttpClientRequest.setHeader("origin", website),
        HttpClientRequest.bodyJsonUnsafe(account)
      )
    );

    expect(signedUp.status).toBe(200);
    expect(signedUp.headers["access-control-allow-origin"]).toBe(website);

    const me = yield* HttpClient.execute(
      HttpClientRequest.get(`${api}/api/me`).pipe(
        HttpClientRequest.setHeader(
          "cookie",
          Cookies.toCookieHeader(signedUp.cookies)
        )
      )
    );

    expect(me.status).toBe(200);
    expect(yield* me.json).toMatchObject({
      name: account.name,
      email: account.email,
    });
  })
);

test(
  "another website cannot sign anyone in",
  Effect.gen(function* () {
    const { api } = yield* stack;

    const response = yield* HttpClient.execute(
      HttpClientRequest.post(`${api}/api/auth/sign-in/email`).pipe(
        HttpClientRequest.setHeader("origin", "https://elsewhere.example"),
        HttpClientRequest.bodyJsonUnsafe(account)
      )
    );

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
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
