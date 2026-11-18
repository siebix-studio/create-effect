import { Api } from "@app/domain/api";
import type { Greeting } from "@app/domain/greeting";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import * as GreetingRepo from "./repos/greeting.ts";

const greet = (name: string): Greeting => ({ message: `Hello, ${name}!` });

export const GreetingsLive = HttpApiBuilder.group(
  Api,
  "greetings",
  Effect.fnUntraced(function* (handlers) {
    const greetings = yield* GreetingRepo.Service;

    // A caller cannot act on a failing database, so that is a defect (a 500), not a declared error.
    return handlers.handleAll({
      greet: ({ params }) =>
        greetings
          .record(params.name)
          .pipe(
            Effect.as(greet(params.name)),
            Effect.orDie,
            Effect.withSpan("greet", { attributes: { name: params.name } })
          ),
      listRecent: () =>
        greetings.listRecent.pipe(
          Effect.map((names) => names.map(greet)),
          Effect.orDie
        ),
    });
  })
);
