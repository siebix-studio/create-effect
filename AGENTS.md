# Project

`create-effect` is a CLI that scaffolds full-stack Effect apps deployed with Alchemy, plus the website that presents it and the API that counts how often it is used. The repository is `siebix-studio/create-effect`. The Alchemy stack (`EffectScaffold`) and its state store (`effect-scaffold-state`) keep the project's earlier name, because renaming them would change the identity of what is deployed. It is a Bun workspace:

- `apps/cli`: the CLI, published as `@siebix/create-effect` (binary `create-effect`, run as `bunx @siebix/create-effect my-app`). Built with `effect/cli`.
- `apps/cli/src`: one module per concern, imported as a namespace (`import * as Git from "./git.ts"`). `project.ts` holds the `ProjectName` schema, `answers.ts` settles every question from flags, prompts or defaults, `template.ts` writes the files, `project-record.ts` reads and writes `create-effect.json`, the record in a project of which features it has, `cli.ts` defines the flags and the command that ties these together, and `git.ts` and `package-manager.ts` are services over the command-line programs (run through `process.ts`), so tests replace them with stand-ins. `telemetry.ts` is the service that reports a run to the API, and holds the schema of what is reported. Expected failures are `Schema.TaggedError`s; the ones meant for the user carry `[CliError.userMessage]`, which `Command.run` prints.
- `apps/cli/template`: the project the CLI creates. It is copied as is, with `{{name}}` and `{{pascalName}}` filled in and `gitignore` and `oxlint.config.template.ts` renamed (see `src/template.ts`). It is not part of this workspace.
- `apps/cli/overlays/github-actions`: what `--github-actions` adds to the template: the deploy workflow, `stacks/github.ts`, and an `alchemy.run.ts` that comments on pull request previews.
- `apps/web`: the website, a prerendered (SSG) Foldkit app served at `effect.siebix.com`. It reads the usage numbers from the API in the browser, and again every minute; the prerendered pages hold none. The project count runs up to its value frame by frame in the Model (`shownProjects`), and not at all with reduced motion.
- `apps/api`: the API, a Worker served at `effect-api.siebix.com`. `contract.ts` is its `HttpApi` (the website's client is derived from it), `worker.ts` serves it, with `/stats` cached at Cloudflare's edge and in browsers for a minute, and `usage.ts` is the Durable Object that counts: one instance, with the events and their counters in its SQLite database (`migrations/`).
- Root: the Alchemy stack (`alchemy.run.ts`, `domain.ts`, `access.ts`, `state.ts`) and its test (`test/integ.test.ts`), the CI credentials stack (`stacks/github.ts`), the workflow that checks, deploys and releases (`.github/workflows/ci.yml`), `.mcp.json` (the Foldkit DevTools for `apps/web`), and the shared lint, format and TypeScript config.

Commands, from the root: `bun run check` (lint and format), `bun run fix`, `bun run typecheck`, `bun run test`, `bun run cli -- <args>` (never counted as a run), `bun run dev` (`alchemy dev`).

# Changing what the CLI creates

- The template and the overlays hold real files, not a templating language. The only substitutions are `{{name}}` and `{{pascalName}}`, and there are no conditionals. Every file has to parse as what it is: this repository's lint skips these folders, but its formatter runs on them.
- A file that depends on a flag goes in that flag's overlay. An overlay's files replace the template's, except that its `package.json` holds only what it adds and is merged in, and its Markdown files hold only the sections they add and are appended (`layer` in `src/template.ts`). The `github-actions` overlay replaces `alchemy.run.ts`, so a change to the template's has to be made there too.
- The `add` subcommand lays an overlay over a project that already exists, so an overlay has to work there as well: laying it twice changes nothing, and a file that is no longer what the template wrote is left alone and reported. An overlay must not depend on a file it may not get to replace; the deploy workflow, for one, checks whichever providers the stack registers and does not assume the GitHub one. A new overlay is registered in `OVERLAY_URLS` and `OVERLAYS` in `src/template.ts` and gets its next steps in `src/cli.ts`. `add` stops when the record already lists the feature; a project without a record, from before 0.3, is treated as having none.
- `add` is a subcommand of the root command, which itself takes the project directory. A project called `add` is created as `./add`.
- A dependency is added to the template's catalog (or the overlay's `package.json`) at the version the root `package.json` has; `test/template.test.ts` fails otherwise.
- npm leaves `.gitignore` out of a published package, so it is stored as `gitignore`. Other dotfiles (`.mcp.json`, `.github/`) ship under their own name.
- The generated project documents itself: `README.md` for people and `AGENTS.md` for agents, both in the template, with the overlay adding its own sections. Change them with the code they describe.
- A new flag is defined in `src/cli.ts`, carried through `Input` and `Answers` in `src/answers.ts`, and echoed in the "Run it again" line. It is listed in the flag tables of `README.md` and `apps/cli/README.md`. Every question has a flag, but not every flag is a question (`--force`, `--yes`); a new question also changes the sample session and the "Four questions" section in `apps/web/src/main.ts`, and the sentence in both READMEs that lists the questions.
- A change to what CLI users get needs a changeset (`bun changeset`); see "Releasing" in `README.md`.

# Counting runs

- The CLI reports to `effect-api.siebix.com`, and that address and the shape of the event are in every copy of the CLI that is installed. `Event` in `apps/cli/src/telemetry.ts` is what the API decodes with, so a field can be added to it as optional, but none can be removed, renamed or narrowed. The same goes for the path `/events`.
- Reporting must never cost the user anything: it runs beside the other steps, gives up after three seconds, and its failure is ignored. It is off with `DO_NOT_TRACK`, with `CREATE_EFFECT_TELEMETRY=0` and in CI, and whenever it is on the CLI says so.
- An event carries what was chosen and nothing about who chose it: no project name, no path. The API keeps no IP address, which is why its Worker has invocation logs and traces off.
- A new breakdown is a new counter in `countersOf` (`apps/api/src/usage.ts`), a field of `Stats` in `contract.ts`, and a row in the website's "How it is used" section. Counters only count from the deploy that adds them; the `events` table keeps every event so older ones can be counted afterwards.
- A deploy reaches the Worker at once, but a busy Durable Object can keep running its old code for minutes. Add a method to `usage.ts` one deploy before `worker.ts` calls it.
- A change to the tables is a new file in `apps/api/migrations`. A file that was deployed is never edited: each is applied once, when the Durable Object wakes up.

# Tests

The root's `test/integ.test.ts` runs the stack on this machine, as `alchemy dev` does, and reports events to the API over HTTP. It is what proves the Durable Object's SQL. `apps/api/test/usage.test.ts` covers which counters an event adds to, and `apps/web/src/scene.test.ts` what the website shows.

Each file in `apps/cli/test` has one job:

- `cli.test.ts` runs the command in-process against a temporary directory, with stand-ins for git, the package manager and telemetry, and scripted key presses for the prompts. It covers what the CLI decides: flags, questions, the order of steps, what a run reports, and how files are renamed, filled in, merged and appended, and that `add` ends in the same files as its flag. Don't assert on the template's own text here.
- `telemetry.test.ts` covers the telemetry service against a stand-in for the network: what is sent, each way of opting out, and that a failed request fails nothing.
- `template.test.ts` holds the template's and the overlays' versions to the root `package.json`.
- `e2e.test.ts` creates real projects, installs them and runs their lint, typecheck and tests. This is what proves the template works, so a flag that changes the written files gets a row there. It runs the CLI with `DO_NOT_TRACK=1`, so these projects are not counted. It takes about half a minute.

# Local references

- A local Effect source reference is available at `~/.local/share/effect-solutions/effect`. Use it for Effect v4 APIs, usage patterns, types, Schema, and HTTP API details.

- Effect module guides live in `~/.local/share/effect-solutions/effect/packages/effect/`: `SCHEMA.md` (Schema), `HTTPAPI.md` (HttpApi), `CONFIG.md` (Config), `MCP.md` (MCP), `OPTIC.md` (Optic), and `ARBITRARY.md` (Arbitrary). The CLI module source is in `packages/effect/src/cli/`.

- A local Alchemy source reference is available at `~/.local/share/alchemy`. Use it for Alchemy APIs, usage patterns, types, and examples. Provider packages (e.g. `cloudflare`, `aws`, `stripe`) are in `packages/`, and example apps are in `examples/`.

- Alchemy website docs (the published docs source) live at `~/.local/share/alchemy/website/src/content/docs/`.

- A local Foldkit source reference is available at `~/.local/share/foldkit`. Use it for Foldkit APIs, usage patterns, types, and examples. Library source is in `packages/foldkit/src/`, focused example apps are in `examples/`, and full apps built with Foldkit are in `packages/website/` and `packages/typing-game/`.

- Foldkit website docs (the published docs source) live at `~/.local/share/foldkit/packages/website/src/page/` (the `.md` files).

- Foldkit's agent guide lives at `~/.local/share/foldkit/skills/foldkit/SKILL.md`. Read it before writing Foldkit code.
