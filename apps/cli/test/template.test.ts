import { assert, it } from "@effect/vitest";

import RootPackageJson from "../../../package.json" with { type: "json" };
import BetterAuthPackageJson from "../overlays/better-auth/package.json" with { type: "json" };
import GitHubActionsPackageJson from "../overlays/github-actions/package.json" with { type: "json" };
import NeonPackageJson from "../overlays/neon/package.json" with { type: "json" };
import TemplatePackageJson from "../template/package.json" with { type: "json" };

it("the template and its overlays pin the same versions as this repository", () => {
  const root = new Map(
    Object.entries({
      ...RootPackageJson.devDependencies,
      ...RootPackageJson.workspaces.catalog,
    })
  );

  const template = Object.entries({
    ...TemplatePackageJson.devDependencies,
    ...TemplatePackageJson.workspaces.catalog,
    ...GitHubActionsPackageJson.devDependencies,
    ...GitHubActionsPackageJson.workspaces.catalog,
    ...NeonPackageJson.devDependencies,
    ...NeonPackageJson.workspaces.catalog,
    ...BetterAuthPackageJson.workspaces.catalog,
  });

  for (const [name, version] of template) {
    if (version !== "catalog:") {
      assert.strictEqual(version, root.get(name), name);
    }
  }
});
