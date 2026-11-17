import {
  Command,
  expect,
  given,
  label,
  role,
  scene,
  submit,
  text,
  type,
} from "foldkit/scene";
import { describe, test } from "vitest";

import {
  FetchGreeting,
  GreetingAsyncData,
  Message,
  Model,
  update,
  view,
} from "./main";
import { AppRoute } from "./route";

const initialModel = Model.make({
  route: AppRoute.Home(),
  nameInput: "",
  greeting: GreetingAsyncData.Idle(),
});

describe("view", () => {
  test("submitting a name shows the greeting from the API", () => {
    scene(
      { update, view },
      given(initialModel),
      type(label("Your name"), "Ada"),
      submit(role("form")),
      Command.expectExact(FetchGreeting({ name: "Ada" })),
      expect(text("Asking the API...")).toExist(),
      Command.resolve(
        FetchGreeting,
        Message.SucceededFetchGreeting({ greeting: { message: "Hello, Ada!" } })
      ),
      expect(text("Hello, Ada!")).toExist()
    );
  });

  test("an unknown path shows the not found page", () => {
    scene(
      { update, view },
      given(
        Model.make({
          route: AppRoute.NotFound({ path: "/nope" }),
          nameInput: "",
          greeting: GreetingAsyncData.Idle(),
        })
      ),
      expect(role("heading", { name: "Page not found" })).toExist(),
      expect(text("Nothing lives at /nope.")).toExist()
    );
  });
});
