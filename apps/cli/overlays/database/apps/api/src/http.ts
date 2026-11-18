import { Api } from "@app/domain/api";
import * as Http from "alchemy/Http";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { GreetingsLive } from "./handlers.ts";
import * as GreetingRepo from "./repos/greeting.ts";

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(GreetingsLive),
  Layer.provide(GreetingRepo.layer),
  Layer.provide(Http.Platform),
  // On workers.dev the website is another origin. The API holds no credentials, so any origin
  // may read it.
  Layer.provide(
    HttpRouter.cors({
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  )
);
