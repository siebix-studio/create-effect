# {{name}}

A full-stack Effect app on Cloudflare, deployed with [Alchemy](https://alchemy.run). Created with [create-effect](https://effect.siebix.com).

## Layout

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | The Effect HTTP API, a Cloudflare Worker with a [D1](https://developers.cloudflare.com/d1/) database |
| `apps/web` | The website, a prerendered [Foldkit](https://foldkit.dev) app |
| `migrations` | The SQL files that define the database |
| `alchemy.run.ts` | The stack that deploys all of it |

## Development

```sh
bun run dev         # the API (localhost:1337) and the website (localhost:5173), under alchemy dev
bun run check       # lint and format (ultracite)
bun run fix         # apply lint and format fixes
bun run typecheck   # the stack file, then every workspace
bun run test        # API tests, Foldkit scene tests, and a test of the whole stack
```

`bun run dev` and `bun run test` run everything on your machine, the database included. Neither needs a Cloudflare account.

## Database

The API stores every name it greets in D1, Cloudflare's SQLite, and `GET /greetings` reads the last ones back.

- `migrations/` holds the schema as numbered `.sql` files. The ones that have not run yet are applied whenever the stack starts or deploys. To change the schema, add a file; a file that has been applied cannot be edited.
- `apps/api/src/repos/greeting.ts` holds the queries, written with [Effect SQL](https://effect.website). Handlers call the repository and never see SQL.
- `apps/api/src/database.ts` declares the database, and `apps/api/src/worker.ts` binds it to the Worker.

D1 has no transactions that span statements. For writes that must succeed or fail together, use `batch` on the binding.

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
