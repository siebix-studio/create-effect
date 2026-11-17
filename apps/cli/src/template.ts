import * as Array from "effect/Array";
import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

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

const copyDirectory = (
  from: string,
  to: string,
  project: Project
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
          yield* copyDirectory(source, path.join(to, entry), project);
        } else {
          const content = yield* fs.readFileString(source);
          yield* fs.writeFileString(
            path.join(to, RENAMED_ENTRIES.get(entry) ?? entry),
            render(content, project)
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

export const write = Effect.fn("Template.write")(function* (project: Project) {
  const path = yield* Path.Path;
  const template = yield* path.fromFileUrl(TEMPLATE_URL).pipe(Effect.orDie);

  yield* copyDirectory(template, project.directory, project).pipe(
    templateError("write the project")
  );
});
