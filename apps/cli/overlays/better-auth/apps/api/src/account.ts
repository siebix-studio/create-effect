import { CurrentUser } from "@app/domain/account";
import { Api } from "@app/domain/api";
import { HttpApiBuilder } from "effect/http-api";

export const AccountLive = HttpApiBuilder.group(Api, "account", (handlers) =>
  handlers.handleAll({
    me: () => CurrentUser,
  })
);
