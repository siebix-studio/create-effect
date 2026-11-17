import { Api } from "@app/domain/api";
import * as Http from "alchemy/Http";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { GreetingsLive } from "./handlers.ts";

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(GreetingsLive),
  Layer.provide(Http.Platform),
  // The website is served from another origin. The API holds no credentials, so any origin may read it.
  Layer.provide(
    HttpRouter.cors({
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  )
);
