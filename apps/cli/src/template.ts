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

const DATABASE_URL = new URL("../overlays/database", import.meta.url);

/**
 * What a flag, or `add` in a project that already exists, lays over the template: one directory
 * or several, in order. Both databases start with what they share. See `layer` for how an
 * overlay's files land.
 */
const OVERLAY_URLS = {
  "github-actions": [new URL("../overlays/github-actions", import.meta.url)],
  d1: [DATABASE_URL, new URL("../overlays/d1", import.meta.url)],
  neon: [DATABASE_URL, new URL("../overlays/neon", import.meta.url)],
};

export type Overlay = keyof typeof OVERLAY_URLS;

export const OVERLAYS: readonly [Overlay, ...Overlay[]] = [
  "github-actions",
  "d1",
  "neon",
];

/**
 * Template files an overlay builds on without replacing them. A project created before the
 * template had one cannot take the overlay: Neon is registered in `providers.ts`, which only
 * works in a project whose stack reads its providers from there.
 */
const REQUIRED_FILES: Partial<Record<Overlay, readonly string[]>> = {
  neon: ["providers.ts"],
};

const TEMPLATE_SOURCE =
  "https://github.com/siebix-studio/create-effect/blob/main/apps/cli/template";

export class MissingTemplateFile extends Schema.TaggedError<
  MissingTemplateFile,
  { readonly brand: unique symbol }
>()("MissingTemplateFile", {
  overlay: Schema.String,
  file: Schema.String,
}) {
  override get [CliError.userMessage]() {
    return `${this.overlay} builds on ${this.file}, which this project does not have: an older create-effect made it. Nothing was changed. Bring the project in line with ${TEMPLATE_SOURCE}/${this.file} and the files that import it, then run this again.`;
  }
}

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

/** Puts one file in the project. `false` means the file there was left as it is. */
type Place = (
  file: string,
  content: string
) => Effect.Effect<
  boolean,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
>;

const replace: Place = Effect.fnUntraced(function* (file, content) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, content);

  return true;
});

const PackageJson = Schema.fromJsonString(Schema.Json, { space: 2 });

const isJsonObject = (value: Schema.Json): value is Schema.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const DEPENDENCY_FIELDS = new Set(["dependencies", "devDependencies"]);

const sortKeys = (value: Schema.Json): Schema.Json =>
  isJsonObject(value)
    ? Object.fromEntries(
        Object.entries(value).toSorted(([a], [b]) => (a < b ? -1 : 1))
      )
    : value;

/** Objects are merged key by key and anything else is replaced. Dependencies stay sorted. */
const mergeJson = (base: Schema.Json, extra: Schema.Json): Schema.Json => {
  if (!(isJsonObject(base) && isJsonObject(extra))) {
    return extra;
  }

  const merged = new Map(Object.entries(base));

  for (const [key, value] of Object.entries(extra)) {
    merged.set(key, mergeJson(merged.get(key) ?? null, value));
  }

  return Object.fromEntries(
    Array.map([...merged], ([key, value]) => [
      key,
      DEPENDENCY_FIELDS.has(key) ? sortKeys(value) : value,
    ])
  );
};

/**
 * How an overlay's file lands on the one the project has. A `package.json` holds only what the
 * overlay adds and is merged in, and a Markdown file holds only the sections it adds, which go at
 * the end, so neither is a second copy that could drift from the template's.
 *
 * Any other file replaces the project's, but only while that one is still what the template
 * wrote. In a project that has been worked on, a file its owner changed is left alone. Laying an
 * overlay a second time changes nothing.
 */
const layer = (template: string, project: Project): Place =>
  Effect.fnUntraced(function* (file, content) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    if (!(yield* fs.exists(file))) {
      return yield* replace(file, content);
    }

    const existing = yield* fs.readFileString(file);

    if (path.basename(file) === "package.json") {
      const decode = Schema.decodeEffect(PackageJson);
      const base = yield* decode(existing).pipe(Effect.orDie);
      const extra = yield* decode(content).pipe(Effect.orDie);

      const merged = yield* Schema.encodeEffect(PackageJson)(
        mergeJson(base, extra)
      ).pipe(Effect.orDie);

      return yield* replace(file, `${merged}\n`);
    }

    if (path.extname(file) === ".md") {
      return existing.includes(content)
        ? true
        : yield* replace(file, `${existing.trimEnd()}\n\n${content}`);
    }

    if (existing === content) {
      return true;
    }

    const original = path.join(
      template,
      path.relative(project.directory, file)
    );

    const isUntouched =
      (yield* fs.exists(original)) &&
      render(yield* fs.readFileString(original), project) === existing;

    return isUntouched ? yield* replace(file, content) : false;
  });

/** Copies a directory into the project and returns the files that were left as they are. */
const copyDirectory = (
  from: string,
  to: string,
  project: Project,
  place: Place
): Effect.Effect<
  readonly string[],
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs.makeDirectory(to, { recursive: true });
    const entries = yield* fs.readDirectory(from);

    const kept = yield* Effect.forEach(
      Array.filter(entries, (entry) => !SKIPPED_ENTRIES.has(entry)),
      Effect.fnUntraced(function* (entry: string) {
        const source = path.join(from, entry);
        const info = yield* fs.stat(source);

        if (info.type === "Directory") {
          return yield* copyDirectory(
            source,
            path.join(to, entry),
            project,
            place
          );
        }

        const target = path.join(to, RENAMED_ENTRIES.get(entry) ?? entry);
        const content = yield* fs.readFileString(source);

        const isPlaced = yield* place(target, render(content, project));

        return isPlaced ? [] : [target];
      })
    );

    return kept.flat();
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

const directoryOf = Effect.fnUntraced(function* (url: URL) {
  const path = yield* Path.Path;

  return yield* path.fromFileUrl(url).pipe(Effect.orDie);
});

/**
 * Lays an overlay over a project, new or not, and returns the files it left alone because they
 * have changes of their own, as paths inside the project.
 */
export const add = Effect.fn("Template.add")(
  function* (project: Project, overlay: Overlay) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const template = yield* directoryOf(TEMPLATE_URL);

    for (const file of REQUIRED_FILES[overlay] ?? []) {
      if (!(yield* fs.exists(path.join(project.directory, file)))) {
        return yield* new MissingTemplateFile({ overlay, file });
      }
    }

    const kept = yield* Effect.forEach(
      OVERLAY_URLS[overlay],
      Effect.fnUntraced(function* (url) {
        return yield* copyDirectory(
          yield* directoryOf(url),
          project.directory,
          project,
          layer(template, project)
        );
      })
    );

    return Array.map(kept.flat(), (file) =>
      path.relative(project.directory, file)
    );
  },
  (effect, _project, overlay) =>
    effect.pipe(
      Effect.catchTag("PlatformError", (cause) =>
        Effect.fail(new TemplateError({ operation: `add ${overlay}`, cause }))
      )
    )
);

export interface Options {
  readonly overlays: readonly Overlay[];
}

export const write = Effect.fn("Template.write")(function* (
  project: Project,
  options: Options
) {
  yield* copyDirectory(
    yield* directoryOf(TEMPLATE_URL),
    project.directory,
    project,
    replace
  ).pipe(templateError("write the project"));

  yield* Effect.forEach(options.overlays, (overlay) => add(project, overlay), {
    discard: true,
  });
});
