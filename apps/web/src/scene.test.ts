import { expect, given, role, scene, text } from "foldkit/scene";
import { describe, test } from "vitest";

import { INSTALL_COMMAND, Model, update, view } from "./main";
import { AppRoute } from "./route";

describe("view", () => {
  test("the home page shows the install command", () => {
    scene(
      { update, view },
      given(Model.make({ route: AppRoute.Home() })),
      expect(role("heading", { name: "create-effect" })).toExist(),
      expect(text(INSTALL_COMMAND)).toExist()
    );
  });

  test("an unknown path shows the not found page", () => {
    scene(
      { update, view },
      given(Model.make({ route: AppRoute.NotFound({ path: "/nope" }) })),
      expect(role("heading", { name: "Page not found" })).toExist(),
      expect(text("Nothing lives at /nope.")).toExist()
    );
  });
});
