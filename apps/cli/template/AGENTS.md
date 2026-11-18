# Project

`{{name}}` is a full-stack Effect app on Cloudflare, deployed with Alchemy. It is a Bun workspace:

- `packages/domain`: the schemas and the HTTP contract (`api.ts`) shared by both sides.
- `apps/api`: the Effect HTTP API, a Cloudflare Worker that implements the contract.
- `apps/web`: the website, a prerendered (SSG) Foldkit app that calls the API through a typed client derived from the contract.
- Root: the Alchemy stack (`alchemy.run.ts`), a test that runs the whole stack locally (`test/integ.test.ts`), and the shared lint, format and TypeScript config.

Commands, from the root: `bun run dev` (`alchemy dev`), `bun run check` (lint and format), `bun run fix`, `bun run typecheck`, `bun run test`, `bun run deploy`.

# Conventions

- A new endpoint starts in `packages/domain/src/api.ts`, which holds the contract and no logic. It then gets a handler in `apps/api/src/handlers.ts`; errors a handler can fail with are declared on the endpoint. The website calls it through `HttpApiClient`; never write a URL by hand.
- `bun run dev` and `bun run test` run locally and keep their state in `.alchemy/`; only deployed stages touch Cloudflare.
- The website follows Foldkit's Elm-style architecture: a Schema `Model`, past-tense `Message`s, a pure `update` and `view`, side effects only in `Command`s. See https://foldkit.dev before writing Foldkit code.
- Effect is v4. HTTP modules live under `effect/http` and `effect/http-api`.
- The API Worker provides `Cloudflare.Telemetry()`, so deployed stages have Workers Logs and Traces in the Cloudflare dashboard. Wrap work worth seeing there in `Effect.withSpan` (or define it with `Effect.fn`); spans nest in the request's trace. Nothing else is needed: no OTLP endpoint, no flush.
