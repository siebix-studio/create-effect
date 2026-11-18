import { Context, Schema } from "effect";
import { HttpApiMiddleware } from "effect/http-api";

export const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});

export type User = typeof User.Type;

/** The user a request is signed in as. Handlers behind `Authentication` read it. */
export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "app/CurrentUser"
) {}

/** The request carries no session. */
export class Unauthorized extends Schema.TaggedError<
  Unauthorized,
  { readonly brand: unique symbol }
>()("Unauthorized", {}, { httpApiStatus: 401 }) {}

/** Turns the session cookie into the `CurrentUser`, or fails with `Unauthorized`. */
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("app/Authentication", { error: Unauthorized }) {}
