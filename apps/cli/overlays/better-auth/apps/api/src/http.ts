import { Api } from "@app/domain/api";
import * as Http from "alchemy/Http";
import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { AccountLive } from "./account.ts";
import { AuthenticationLive } from "./auth.ts";
import { GreetingsLive } from "./handlers.ts";
import * as GreetingRepo from "./repos/greeting.ts";

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(GreetingsLive),
  Layer.provide(AccountLive),
  Layer.provide(AuthenticationLive),
  Layer.provide(GreetingRepo.layer),
  Layer.provide(Http.Platform)
);
