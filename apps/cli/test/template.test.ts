import { assert, it } from "@effect/vitest";

import RootPackageJson from "../../../package.json" with { type: "json" };
import D1PackageJson from "../overlays/d1/package.json" with { type: "json" };
import NeonPackageJson from "../overlays/neon/package.json" with { type: "json" };
import TemplatePackageJson from "../template/package.json" with { type: "json" };

it("the template and its overlays pin the same versions as this repository", () => {
  const root = new Map(
    Object.entries({
      ...RootPackageJson.devDependencies,
      ...RootPackageJson.workspaces.catalog,
    })
  );

  const pinned = Object.entries({
    ...TemplatePackageJson.devDependencies,
    ...TemplatePackageJson.workspaces.catalog,
    ...D1PackageJson.workspaces.catalog,
    ...NeonPackageJson.workspaces.catalog,
  });

  for (const [name, version] of pinned) {
    if (version !== "catalog:") {
      assert.strictEqual(version, root.get(name), name);
    }
  }
});
