import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

const MAX_NAME_LENGTH = 40;

export const ProjectName = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/u, {
    message:
      "use lowercase letters, digits and dashes, starting with a letter or digit",
  }),
  Schema.isMaxLength(MAX_NAME_LENGTH, {
    message: `use at most ${MAX_NAME_LENGTH} characters`,
  })
).pipe(Schema.brand("ProjectName"));

export type ProjectName = typeof ProjectName.Type;

export const Project = Schema.Struct({
  name: ProjectName,
  directory: Schema.String,
});

export interface Project extends Schema.Schema.Type<typeof Project> {}

export class InvalidProjectName extends Schema.TaggedError<
  InvalidProjectName,
  { readonly brand: unique symbol }
>()("InvalidProjectName", { input: Schema.String, reason: Schema.String }) {
  override get [CliError.userMessage]() {
    return `"${this.input}" is not a valid project name: ${this.reason}.`;
  }
}

export const parseName = Effect.fn("Project.parseName")(function* (
  name: string
) {
  return yield* Schema.decodeEffect(ProjectName)(name).pipe(
    Effect.mapError(
      (error) => new InvalidProjectName({ input: name, reason: error.message })
    )
  );
});

export const fromDirectory = Effect.fn("Project.fromDirectory")(function* (
  directory: string
) {
  const path = yield* Path.Path;
  const name = yield* parseName(path.basename(directory));

  return Project.make({ name, directory });
});

export const stackName = (name: ProjectName): string =>
  name
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");
