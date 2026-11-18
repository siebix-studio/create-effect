import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** What `--domain` takes for a project that stays on workers.dev. */
export const NONE = "none";

const MAX_LENGTH = 253;

/** A hostname as DNS writes it: lowercase labels joined by dots, at least two of them. */
export const Hostname = Schema.String.check(
  Schema.isPattern(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/u,
    {
      message:
        "write it as a hostname, like example.com or app.example.com, without https:// or a path",
    }
  ),
  Schema.isMaxLength(MAX_LENGTH, {
    message: `use at most ${MAX_LENGTH} characters`,
  })
).pipe(Schema.brand("Hostname"));

export type Hostname = typeof Hostname.Type;

export class InvalidDomain extends Schema.TaggedError<
  InvalidDomain,
  { readonly brand: unique symbol }
>()("InvalidDomain", { input: Schema.String, reason: Schema.String }) {
  override get [CliError.userMessage]() {
    return `"${this.input}" is not a domain: ${this.reason}. Pass --domain ${NONE} to stay on workers.dev.`;
  }
}

/** `none`, or nothing at all, is a project without a domain. */
export const parse = Effect.fn("Domain.parse")(function* (input: string) {
  const answer = input.trim().toLowerCase();

  if (answer === "" || answer === NONE) {
    return Option.none<Hostname>();
  }

  const hostname = yield* Schema.decodeEffect(Hostname)(answer).pipe(
    Effect.mapError(
      (error) => new InvalidDomain({ input, reason: error.message })
    )
  );

  return Option.some(hostname);
});
