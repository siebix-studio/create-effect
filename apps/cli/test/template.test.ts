import { assert, it } from "@effect/vitest";

import RootPackageJson from "../../../package.json" with { type: "json" };
import RecordSchema from "../../web/public/schema.json" with { type: "json" };
import GitHubActionsPackageJson from "../overlays/github-actions/package.json" with { type: "json" };
import * as Template from "../src/template.ts";
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
    ...GitHubActionsPackageJson.devDependencies,
    ...GitHubActionsPackageJson.workspaces.catalog,
  });

  for (const [name, version] of template) {
    if (version !== "catalog:") {
      assert.strictEqual(version, root.get(name), name);
    }
  }
});

it("the record's published schema lists every feature", () => {
  assert.deepStrictEqual(RecordSchema.properties.features.items.enum, [
    ...Template.OVERLAYS,
  ]);
});
