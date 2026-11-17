# Project

`create-effect` is a CLI that scaffolds full-stack Effect apps deployed with Alchemy, plus the website that presents it. The repository is still named `effect-scaffold`. It is a Bun workspace:

- `apps/cli`: the CLI, published as `@siebix/create-effect` (binary `create-effect`, run as `bunx @siebix/create-effect my-app`). Built with `effect/cli`.
- `apps/cli/src`: one module per concern, imported as a namespace (`import * as Git from "./git.ts"`). `project.ts` holds the `ProjectName` schema, `answers.ts` settles every question from flags, prompts or defaults, `template.ts` writes the files, and `git.ts` and `package-manager.ts` are services over the command-line programs, so tests replace them with stand-ins. Expected failures are `Schema.TaggedError`s; the ones meant for the user carry `[CliError.userMessage]`, which `Command.run` prints.
- `apps/cli/template`: the project the CLI creates. It is copied as is, with `{{name}}` and `{{pascalName}}` filled in and `gitignore` and `oxlint.config.template.ts` renamed (see `src/template.ts`). It is not part of this workspace and is excluded from this repository's lint; `apps/cli/test/e2e.test.ts` creates a project and runs its lint, typecheck and tests. Its dependency versions must match the root `package.json` (`test/template.test.ts`).
- `apps/web`: the website, a prerendered (SSG) Foldkit app served at `effect.siebix.com`.
- Root: the Alchemy stack (`alchemy.run.ts`, `domain.ts`, `access.ts`, `state.ts`), the CI credentials stack (`stacks/github.ts`), and the shared lint, format and TypeScript config.

Commands, from the root: `bun run check` (lint and format), `bun run typecheck`, `bun run test`, `bun run cli -- <args>`, `bun run dev` (`alchemy dev`).

A change to what CLI users get needs a changeset (`bun changeset`); see "Releasing" in `README.md`.

# Local references

- A local Effect source reference is available at `~/.local/share/effect-solutions/effect`. Use it for Effect v4 APIs, usage patterns, types, Schema, and HTTP API details.

- Effect module guides live in `~/.local/share/effect-solutions/effect/packages/effect/`: `SCHEMA.md` (Schema), `HTTPAPI.md` (HttpApi), `CONFIG.md` (Config), `MCP.md` (MCP), `OPTIC.md` (Optic), and `ARBITRARY.md` (Arbitrary). The CLI module source is in `packages/effect/src/cli/`.

- A local Alchemy source reference is available at `~/.local/share/alchemy`. Use it for Alchemy APIs, usage patterns, types, and examples. Provider packages (e.g. `cloudflare`, `aws`, `stripe`) are in `packages/`, and example apps are in `examples/`.

- Alchemy website docs (the published docs source) live at `~/.local/share/alchemy/website/src/content/docs/`.

- A local Foldkit source reference is available at `~/.local/share/foldkit`. Use it for Foldkit APIs, usage patterns, types, and examples. Library source is in `packages/foldkit/src/`, focused example apps are in `examples/`, and full apps built with Foldkit are in `packages/website/` and `packages/typing-game/`.

- Foldkit website docs (the published docs source) live at `~/.local/share/foldkit/packages/website/src/page/` (the `.md` files).

- Foldkit's agent guide lives at `~/.local/share/foldkit/skills/foldkit/SKILL.md`. Read it before writing Foldkit code.
