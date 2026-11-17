import * as Array from "effect/Array";
import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

import * as Database from "./database.ts";
import { stackName } from "./project.ts";
import type { Project } from "./project.ts";

export class DirectoryNotEmpty extends Schema.TaggedError<
  DirectoryNotEmpty,
  { readonly brand: unique symbol }
>()("DirectoryNotEmpty", { directory: Schema.String }) {
  override get [CliError.userMessage]() {
    return `${this.directory} is not empty. Pick another name, or pass --force to write into it anyway.`;
  }
}

export class TemplateError extends Schema.TaggedError<
  TemplateError,
  { readonly brand: unique symbol }
>()("TemplateError", { operation: Schema.String, cause: Schema.Defect() }) {
  override get [CliError.userMessage]() {
    return `Could not ${this.operation}: ${String(this.cause)}`;
  }
}

const templateError = (operation: string) =>
  Effect.mapError(
    (cause: PlatformError.PlatformError) =>
      new TemplateError({ operation, cause })
  );

const TEMPLATE_URL = new URL("../template", import.meta.url);

const OVERLAYS_URL = new URL("../overlays", import.meta.url);

const PACKAGE_JSON = "package.json";

const DEPENDENCY_FIELDS = new Set(["dependencies", "devDependencies"]);

const JSON_INDENT = 2;

const SKIPPED_ENTRIES = new Set([
  "node_modules",
  "dist",
  ".alchemy",
  "bun.lock",
]);

/**
 * Files the template can't store under their real name:
 *
 * - npm leaves `.gitignore` files out of published packages.
 * - Oxlint would load an `oxlint.config.ts` as a nested config while linting this repository.
 */
const RENAMED_ENTRIES = new Map([
  ["gitignore", ".gitignore"],
  ["oxlint.config.template.ts", "oxlint.config.ts"],
]);

const render = (content: string, project: Project): string =>
  content
    .replaceAll("{{name}}", project.name)
    .replaceAll("{{pascalName}}", stackName(project.name));

const PackageJson = Schema.fromJsonString(Schema.JsonObject);

const isJsonObject = (
  value: Schema.Json | undefined
): value is Schema.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sortKeys = (object: Schema.JsonObject): Schema.JsonObject =>
  Object.fromEntries(
    Object.entries(object).toSorted(([a], [b]) => a.localeCompare(b))
  );

/**
 * Adds an overlay's fields to a `package.json`. Objects merge key by key and everything else is
 * replaced. Dependencies are kept in alphabetical order, as the formatter in the project expects.
 */
const mergeJson = (
  base: Schema.JsonObject,
  overlay: Schema.JsonObject
): Schema.JsonObject =>
  Object.fromEntries([
    ...Object.entries(base),
    ...Object.entries(overlay).map(([key, value]) => {
      const existing = base[key];

      const merged =
        isJsonObject(existing) && isJsonObject(value)
          ? mergeJson(existing, value)
          : value;

      return [
        key,
        DEPENDENCY_FIELDS.has(key) && isJsonObject(merged)
          ? sortKeys(merged)
          : merged,
      ] as const;
    }),
  ]);

const mergePackageJson = Effect.fn("Template.mergePackageJson")(function* (
  base: string,
  overlay: string
) {
  const decode = Schema.decodeEffect(PackageJson);
  const merged = mergeJson(yield* decode(base), yield* decode(overlay));

  return `${JSON.stringify(merged, null, JSON_INDENT)}\n`;
}, Effect.orDie);

/**
 * Copies a directory into the project. An overlay's `package.json` is merged into the one already
 * written, so it only lists what it adds; every other file replaces what is there.
 */
const copyDirectory = (
  from: string,
  to: string,
  project: Project,
  kind: "template" | "overlay"
): Effect.Effect<
  void,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs.makeDirectory(to, { recursive: true });
    const entries = yield* fs.readDirectory(from);

    yield* Effect.forEach(
      Array.filter(entries, (entry) => !SKIPPED_ENTRIES.has(entry)),
      Effect.fnUntraced(function* (entry) {
        const source = path.join(from, entry);
        const info = yield* fs.stat(source);

        if (info.type === "Directory") {
          yield* copyDirectory(source, path.join(to, entry), project, kind);
        } else {
          const target = path.join(to, RENAMED_ENTRIES.get(entry) ?? entry);
          const content = render(yield* fs.readFileString(source), project);

          yield* fs.writeFileString(
            target,
            kind === "overlay" && entry === PACKAGE_JSON
              ? yield* mergePackageJson(
                  yield* fs.readFileString(target),
                  content
                )
              : content
          );
        }
      }),
      { discard: true }
    );
  });

export const isEmpty = Effect.fn("Template.isEmpty")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;

    return (
      !(yield* fs.exists(directory)) ||
      Array.isArrayEmpty(yield* fs.readDirectory(directory))
    );
  },
  (effect, directory) => effect.pipe(templateError(`read ${directory}`))
);

export const write = Effect.fn("Template.write")(
  function* (project: Project, database: Database.Database) {
    const path = yield* Path.Path;
    const template = yield* path.fromFileUrl(TEMPLATE_URL).pipe(Effect.orDie);
    const overlays = yield* path.fromFileUrl(OVERLAYS_URL).pipe(Effect.orDie);

    yield* copyDirectory(template, project.directory, project, "template");

    yield* Effect.forEach(
      Database.overlays(database),
      (overlay) =>
        copyDirectory(
          path.join(overlays, overlay),
          project.directory,
          project,
          "overlay"
        ),
      { discard: true }
    );
  },
  (effect) => effect.pipe(templateError("write the project"))
);
