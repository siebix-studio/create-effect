import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export const ENDPOINT = "https://effect-api.siebix.com/events";

const TIMEOUT = "3 seconds";

const MAX_FEATURES = 16;

const Label = Schema.String.check(Schema.isPattern(/^[\w.+-]{1,40}$/u));

const shared = {
  /** For `create`, what the project was created with. For `add`, what was added. */
  features: Schema.Array(Label).check(Schema.isMaxLength(MAX_FEATURES)),
  install: Schema.Boolean,
  cliVersion: Label,
  platform: Label,
};

export const Created = Schema.Struct({
  command: Schema.Literal("create"),
  ...shared,
  git: Schema.Boolean,
  /** At least one answer came from a prompt. */
  interactive: Schema.Boolean,
});

export const Added = Schema.Struct({
  command: Schema.Literal("add"),
  ...shared,
});

/**
 * What a run reports. The API decodes with this schema and installed copies of the CLI keep
 * sending the shape they shipped with, so fields can only be added, as optional.
 */
export const Event = Schema.Union([Created, Added]);

export type Event = typeof Event.Type;

export interface Interface {
  /** False when the user opted out, and in CI. */
  readonly enabled: boolean;
  /** Never fails. */
  readonly record: (event: Event) => Effect.Effect<void>;
}

export class Service extends Context.Service<Service, Interface>()(
  "create-effect/Telemetry"
) {}

const flag = (name: string, fallback: boolean) =>
  Config.Boolean(name).pipe(Config.withDefault(fallback));

const isEnabled = Effect.gen(function* () {
  const doNotTrack = yield* flag("DO_NOT_TRACK", false);
  const ci = yield* flag("CI", false);
  const own = yield* flag("CREATE_EFFECT_TELEMETRY", true);

  return own && !doNotTrack && !ci;
  // A setting that cannot be read is not consent.
}).pipe(Effect.orElseSucceed(() => false));

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const enabled = yield* isEnabled;

    // For trying the CLI against `alchemy dev`.
    const endpoint = yield* Config.String("CREATE_EFFECT_TELEMETRY_URL").pipe(
      Config.withDefault(ENDPOINT),
      Effect.orElseSucceed(() => ENDPOINT)
    );

    const record = Effect.fn("Telemetry.record")(function* (event: Event) {
      if (!enabled) {
        return;
      }

      yield* client
        .execute(
          HttpClientRequest.post(endpoint).pipe(
            HttpClientRequest.bodyJsonUnsafe(event)
          )
        )
        .pipe(Effect.timeout(TIMEOUT), Effect.ignore);
    });

    return Service.of({ enabled, record });
  })
);
