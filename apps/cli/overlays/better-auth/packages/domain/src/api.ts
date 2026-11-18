import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication, User } from "./account.ts";
import { Greeting } from "./greeting.ts";

// Every path starts with /api, so the API can share an origin with the website.
export const Api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("greetings")
      .add(
        HttpApiEndpoint.get("greet", "/greetings/:name", {
          params: { name: Schema.String },
          success: Greeting,
        })
      )
      .add(
        HttpApiEndpoint.get("listRecent", "/greetings", {
          success: Schema.Array(Greeting),
        })
      )
  )
  .add(
    HttpApiGroup.make("account")
      .add(HttpApiEndpoint.get("me", "/me", { success: User }))
      .middleware(Authentication)
  )
  .prefix("/api");
