import { assert, it } from "@effect/vitest";

import RootPackageJson from "../../../package.json" with { type: "json" };
import TemplatePackageJson from "../template/package.json" with { type: "json" };

it("the template pins the same versions as this repository", () => {
  const root = new Map(
    Object.entries({
      ...RootPackageJson.devDependencies,
      ...RootPackageJson.workspaces.catalog,
    })
  );

  const template = Object.entries({
    ...TemplatePackageJson.devDependencies,
    ...TemplatePackageJson.workspaces.catalog,
  });

  for (const [name, version] of template) {
    if (version !== "catalog:") {
      assert.strictEqual(version, root.get(name), name);
    }
  }
});
