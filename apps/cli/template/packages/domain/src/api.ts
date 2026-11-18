import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Greeting } from "./greeting.ts";

// Every path starts with /api, so the API can share an origin with the website.
export const Api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("greetings").add(
      HttpApiEndpoint.get("greet", "/greetings/:name", {
        params: { name: Schema.String },
        success: Greeting,
      })
    )
  )
  .prefix("/api");
