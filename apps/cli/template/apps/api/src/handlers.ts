import { Api } from "@app/domain/api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

export const GreetingsLive = HttpApiBuilder.group(
  Api,
  "greetings",
  (handlers) =>
    handlers.handleAll({
      greet: ({ params }) =>
        Effect.succeed({ message: `Hello, ${params.name}!` }).pipe(
          Effect.withSpan("greet", { attributes: { name: params.name } })
        ),
    })
);
