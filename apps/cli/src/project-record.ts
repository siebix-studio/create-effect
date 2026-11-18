import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

/** The file in a project's root that says what create-effect wrote into it. */
export const FILE = "create-effect.json";

/** Served by the website (`apps/web/public/schema.json`), so editors can check the file. */
const SCHEMA_URL = "https://effect.siebix.com/schema.json";

export const ProjectRecord = Schema.Struct({
  $schema: Schema.String,
  /** The create-effect version that last changed the project. */
  version: Schema.String,
  /** A newer create-effect may have added features this one does not know, so any name is read. */
  features: Schema.Array(Schema.String),
});

export interface ProjectRecord extends Schema.Schema.Type<
  typeof ProjectRecord
> {}

const Json = Schema.fromJsonString(ProjectRecord, { space: 2 });

const PRINT_WIDTH = 80;

/**
 * `JSON.stringify` puts every array item on its own line, and the project's formatter would then
 * fail `bun run check` on this file. It keeps an array on one line while the line fits.
 */
const inlineShortArrays = (json: string): string =>
  json.replaceAll(
    /^(?<start>\s*"[^"]+": )\[\n(?<items>[^\]]+)\n\s*\]/gmu,
    (expanded: string, start: string, items: string) => {
      const line = `${start}[${items
        .split(",\n")
        .map((item) => item.trim())
        .join(", ")}]`;

      // One more column for the comma that may follow.
      return line.length < PRINT_WIDTH ? line : expanded;
    }
  );

export class ProjectRecordError extends Schema.TaggedError<
  ProjectRecordError,
  { readonly brand: unique symbol }
>()("ProjectRecordError", {
  operation: Schema.Literals(["read", "write"]),
  file: Schema.String,
  cause: Schema.Defect(),
}) {
  override get [CliError.userMessage]() {
    return `Could not ${this.operation} ${this.file}: ${String(this.cause)}`;
  }
}

/** `None` for a project from before the record existed, or one whose owner deleted it. */
export const read = Effect.fn("ProjectRecord.read")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(directory, FILE);

  const content = yield* fs.exists(file).pipe(
    Effect.flatMap((exists) =>
      exists ? Effect.asSome(fs.readFileString(file)) : Effect.succeedNone
    ),
    Effect.mapError(
      (cause) => new ProjectRecordError({ operation: "read", file, cause })
    )
  );

  if (Option.isNone(content)) {
    return Option.none<ProjectRecord>();
  }

  const record = yield* Schema.decodeEffect(Json)(content.value).pipe(
    Effect.mapError(
      (cause) => new ProjectRecordError({ operation: "read", file, cause })
    )
  );

  return Option.some(record);
});

export const write = Effect.fn("ProjectRecord.write")(function* (
  directory: string,
  record: Omit<ProjectRecord, "$schema">
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(directory, FILE);

  const content = yield* Schema.encodeEffect(Json)({
    $schema: SCHEMA_URL,
    ...record,
  }).pipe(Effect.orDie);

  yield* fs
    .writeFileString(file, `${inlineShortArrays(content)}\n`)
    .pipe(
      Effect.mapError(
        (cause) => new ProjectRecordError({ operation: "write", file, cause })
      )
    );
});
