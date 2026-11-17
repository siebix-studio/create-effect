import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Greeting } from "./greeting.ts";

export const Api = HttpApi.make("api").add(
  HttpApiGroup.make("greetings").add(
    HttpApiEndpoint.get("greet", "/greetings/:name", {
      params: { name: Schema.String },
      success: Greeting,
    })
  )
);
