import { recommended as effect } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";

export default defineConfig({
  env: core.env,
  extends: [core, antiSlop, effect],
  ignorePatterns: core.ignorePatterns,
  options: { typeAware: true },
  rules: {
    // Effect code is built from anonymous generators (Effect.gen(function* () {}),
    // Effect.fn("name")(function* () {})) and generator declarations, and keeps
    // a module's schemas, tagged errors and services together in one file.
    "func-names": "off",
    "func-style": "off",
    "max-classes-per-file": "off",
    // `const X = Schema...` paired with `type X = typeof X.Type` (and interface +
    // namespace companions) is the Effect idiom; tsc reports real redeclarations.
    "no-redeclare": "off",
    // Schema field order is meaningful (encoded output, constructors), and
    // Effect.tryPromise reads `try` before `catch`.
    "sort-keys": "off",
    // Reports any callback whose first parameter is named `error`, i.e. every
    // Effect.catchTag / mapError / tapError handler.
    "promise/prefer-await-to-callbacks": "off",
    // Misread `Effect.forEach(items, f)` as `Array#forEach` with a `thisArg`.
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-method-this-argument": "off",
    // Misreads `Schema.TaggedError<X>()("X", {...})` as an Error call missing `new`.
    "unicorn/throw-new-error": "off",
    // Opaque schema types: `interface X extends Schema.Schema.Type<typeof S> {}`
    // with an optional `declare namespace X { type Encoded = ... }` companion.
    "typescript/no-empty-interface": ["error", { allowSingleExtends: true }],
    "typescript/no-empty-object-type": [
      "error",
      { allowInterfaces: "with-single-extends" },
    ],
    "typescript/no-namespace": ["error", { allowDeclarations: true }],
  },
});
