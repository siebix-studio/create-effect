# Project

`{{name}}` is a full-stack Effect app on Cloudflare, deployed with Alchemy. It is a Bun workspace:

- `packages/domain`: the schemas and the HTTP contract (`api.ts`) shared by both sides.
- `apps/api`: the Effect HTTP API, a Cloudflare Worker that implements the contract.
- `apps/web`: the website, a prerendered (SSG) Foldkit app that calls the API through a typed client derived from the contract.
- Root: the Alchemy stack (`alchemy.run.ts`), a test that runs the whole stack locally (`test/integ.test.ts`), the shared lint, format and TypeScript config, a lefthook pre-commit hook (`lefthook.yml`) that runs `ultracite fix` on staged files, and `.mcp.json`, which gives agents the Foldkit DevTools.

Commands, from the root: `bun run dev` (`alchemy dev`), `bun run check` (lint and format), `bun run fix`, `bun run typecheck`, `bun run test`, `bun run deploy`.

# Conventions

- A new endpoint starts in `packages/domain/src/api.ts`, which holds the contract and no logic. It then gets a handler in `apps/api/src/handlers.ts`; errors a handler can fail with are declared on the endpoint. The website calls it through `HttpApiClient`; never write a URL by hand.
- `bun run dev` and `bun run test` run locally and keep their state in `.alchemy/`; only deployed stages touch Cloudflare.
- The website follows Foldkit's Elm-style architecture: a Schema `Model`, past-tense `Message`s, a pure `update` and `view`, side effects only in `Command`s.
- Effect is v4. HTTP modules live under `effect/http` and `effect/http-api`.
- Each part has its own tests. A handler is tested through the contract's client with `HttpApiTest` (`apps/api/test`), the website with `foldkit/scene`, which drives `update` and `view` without a browser (`apps/web/src/*.test.ts`), and `test/integ.test.ts` starts the whole stack locally and calls it over HTTP.
- `.mcp.json` starts the `foldkit-devtools` MCP server. While `bun run dev` is running and the website is open in a browser tab, its `foldkit_*` tools read the Model and the Message history, replay past states and dispatch Messages. Use them before adding logging when a question is about the website's state. They return whatever is in the Model, so keep credentials out of it.
- The API Worker provides `Cloudflare.Telemetry()`, so deployed stages have Workers Logs and Traces in the Cloudflare dashboard. Wrap work worth seeing there in `Effect.withSpan` (or define it with `Effect.fn`); spans nest in the request's trace. Nothing else is needed: no OTLP endpoint, no flush.

# References

Look things up in what is installed, not from memory: all three libraries change quickly.

- Effect ships its own agent guide. Read `node_modules/effect/AGENTS.md` before writing Effect code; its examples are in `node_modules/effect/ai-docs/` and the source, with its documentation comments, in `node_modules/effect/src/`.
- Alchemy: https://alchemy.run/llms.txt indexes the docs. The source of the installed version is in `node_modules/alchemy/src/` and `node_modules/@alchemy.run/cloudflare/src/`.
- Foldkit: https://foldkit.dev/llms.txt indexes the docs, and every page is Markdown when `.md` is added to its URL. Read the pages on the architecture before writing Foldkit code.
