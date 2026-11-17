# Project

`{{name}}` is a full-stack Effect app on Cloudflare, deployed with Alchemy. It is a Bun workspace:

- `packages/domain`: the schemas and the HTTP contract (`api.ts`) shared by both sides.
- `apps/api`: the Effect HTTP API, a Cloudflare Worker that implements the contract and stores its data in a Neon Postgres database, reached through Hyperdrive.
- `migrations`: the database schema, as numbered `.sql` files.
- `apps/web`: the website, a prerendered (SSG) Foldkit app that calls the API through a typed client derived from the contract.
- Root: the Alchemy stack (`alchemy.run.ts`), a test that runs the whole stack locally (`test/integ.test.ts`), and the shared lint, format and TypeScript config.

Commands, from the root: `bun run dev` (`alchemy dev`), `bun run check` (lint and format), `bun run fix`, `bun run typecheck`, `bun run test`, `bun run deploy`.

# Conventions

- A new endpoint starts in `packages/domain/src/api.ts`, which holds the contract and no logic. It then gets a handler in `apps/api/src/handlers.ts`; errors a handler can fail with are declared on the endpoint. The website calls it through `HttpApiClient`; never write a URL by hand.
- `bun run dev` and `bun run test` run the API and the website locally and keep their state in `.alchemy/`; only deployed stages touch Cloudflare. The database is always a real Neon project, one per stage, so both commands need Neon credentials (`bun alchemy profile edit --add Neon`, or `NEON_API_KEY`). The stack test creates a project and deletes it afterwards.
- SQL lives in a repository under `apps/api/src/repos`, one file per table, imported as a namespace (`import * as GreetingRepo from "./repos/greeting.ts"`). A repository is a service written against `SqlClient`; it fails with its own `PersistenceError`, never with an HTTP status. Handlers call repositories and hold no SQL, and their tests replace the repository with a stand-in.
- A schema change is a new file in `migrations/`, numbered after the last one. Never edit a migration that has been applied; the next deploy would refuse it.
- The website follows Foldkit's Elm-style architecture: a Schema `Model`, past-tense `Message`s, a pure `update` and `view`, side effects only in `Command`s. See https://foldkit.dev before writing Foldkit code.
- Effect is v4. HTTP modules live under `effect/http` and `effect/http-api`, SQL modules under `effect/sql`.
