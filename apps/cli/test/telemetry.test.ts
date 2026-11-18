import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import * as Telemetry from "../src/telemetry.ts";

const EVENT: Telemetry.Event = {
  command: "create",
  features: ["github-actions"],
  install: true,
  git: true,
  interactive: false,
  cliVersion: "1.2.3",
  platform: "darwin",
};

interface Sent {
  readonly url: string;
  readonly body: Telemetry.Event;
}

const Body = Schema.fromJsonString(Telemetry.Event);

// Decoded as the API decodes it, so a body it would refuse fails the test.
const bodyOf = (request: HttpClientRequest.HttpClientRequest) =>
  Schema.decodeSync(Body)(
    request.body._tag === "Uint8Array"
      ? new TextDecoder().decode(request.body.body)
      : ""
  );

/** Reports `EVENT` under `env`. `respond` is the network; by default the API answers. */
const report = Effect.fn("Test.report")(function* (
  env: Readonly<Record<string, string>>,
  respond: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError
  > = (request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }))
    )
) {
  const sent = yield* Ref.make<readonly Sent[]>([]);

  const client = HttpClient.make((request, url) =>
    Ref.update(sent, (requests) => [
      ...requests,
      { url: url.toString(), body: bodyOf(request) },
    ]).pipe(Effect.andThen(respond(request)))
  );

  const enabled = yield* Effect.gen(function* () {
    const telemetry = yield* Telemetry.Service;
    yield* telemetry.record(EVENT);

    return telemetry.enabled;
  }).pipe(
    Effect.provide(
      Telemetry.layer.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
      )
    )
  );

  return { enabled, sent: yield* Ref.get(sent) };
});

type Environment = Record<string, string>;

const OPTED_OUT: readonly Environment[] = [
  { DO_NOT_TRACK: "1" },
  { DO_NOT_TRACK: "true" },
  { CREATE_EFFECT_TELEMETRY: "0" },
  { CREATE_EFFECT_TELEMETRY: "false" },
  { CI: "true" },
];

const NOT_OPTED_OUT: readonly Environment[] = [
  { DO_NOT_TRACK: "0" },
  { CREATE_EFFECT_TELEMETRY: "1" },
];

describe("telemetry", () => {
  it.effect("sends the event to the API, in a shape the API accepts", () =>
    Effect.gen(function* () {
      const { enabled, sent } = yield* report({});

      assert.isTrue(enabled);
      assert.deepStrictEqual(sent, [{ url: Telemetry.ENDPOINT, body: EVENT }]);
    })
  );

  it.effect.each(OPTED_OUT)("sends nothing with %o", (env) =>
    Effect.gen(function* () {
      const { enabled, sent } = yield* report(env);

      assert.isFalse(enabled);
      assert.deepStrictEqual(sent, []);
    })
  );

  it.effect.each(NOT_OPTED_OUT)("still sends with %o", (env) =>
    Effect.gen(function* () {
      const { enabled, sent } = yield* report(env);

      assert.isTrue(enabled);
      assert.lengthOf(sent, 1);
    })
  );

  it.effect("reports to another API when told to", () =>
    Effect.gen(function* () {
      const url = "http://localhost:1337/events";
      const { sent } = yield* report({ CREATE_EFFECT_TELEMETRY_URL: url });

      assert.deepStrictEqual(sent, [{ url, body: EVENT }]);
    })
  );

  it.effect("carries on when the API cannot be reached", () =>
    Effect.gen(function* () {
      const { sent } = yield* report({}, (request) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request }),
          })
        )
      );

      assert.lengthOf(sent, 1);
    })
  );
});
