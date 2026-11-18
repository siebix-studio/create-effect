# {{name}}

A full-stack Effect app on Cloudflare, deployed with [Alchemy](https://alchemy.run). Created with [create-effect](https://effect.siebix.com).

## Layout

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | The Effect HTTP API, a Cloudflare Worker |
| `apps/web` | The website, a prerendered [Foldkit](https://foldkit.dev) app |
| `alchemy.run.ts` | The stack that deploys both |

## Development

```sh
bun run dev         # the API (localhost:1337) and the website (localhost:5173), under alchemy dev
bun run check       # lint and format (ultracite)
bun run fix         # apply lint and format fixes
bun run typecheck   # the stack file, then every workspace
bun run test        # API tests, Foldkit scene tests, and a test of the whole stack
```

`bun run dev` and `bun run test` run everything on your machine. Neither needs a Cloudflare account.

## Deploying

Deploying needs Cloudflare credentials. Connect your account once:

```sh
bun alchemy profile edit --add Cloudflare
```

Then deploy, and tear down when you are done:

```sh
bun run deploy
bun run destroy
```

Each stage is its own copy of the stack: `bun run deploy --stage prod`. The first deploy also creates this project's state store on your account, a Worker named `{{name}}-state`, which is where Alchemy remembers what it deployed.

## Observability

Deployed stages send Workers Logs and Traces to the Cloudflare dashboard (Workers & Pages → the `Api` Worker → Observability). Every `Effect.withSpan` in the API shows up as a span in the request's trace, next to Cloudflare's own fetch, KV, R2 and D1 spans. Nothing runs or is sent anywhere during `bun run dev` or `bun run test`.
