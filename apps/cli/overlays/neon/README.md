# {{name}}

A full-stack Effect app on Cloudflare with a [Neon](https://neon.com) Postgres database, deployed with [Alchemy](https://alchemy.run). Created with [create-effect](https://effect.siebix.com).

## Layout

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | The Effect HTTP API, a Cloudflare Worker that reaches Postgres through [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| `apps/web` | The website, a prerendered [Foldkit](https://foldkit.dev) app |
| `migrations` | The SQL files that define the database |
| `alchemy.run.ts` | The stack that deploys all of it |

## Development

The database is a real Neon project, also while you develop: Neon has no local stand-in. Create an API key in the [Neon Console](https://console.neon.tech) and store it once:

```sh
bun alchemy profile edit --add Neon
```

In CI, set `NEON_API_KEY` instead.

```sh
bun run dev         # the API (localhost:1337) and the website (localhost:5173), under alchemy dev
bun run check       # lint and format (ultracite)
bun run fix         # apply lint and format fixes
bun run typecheck   # the stack file, then every workspace
bun run test        # API tests, Foldkit scene tests, and a test of the whole stack (creates a Neon project)
```

`bun run dev` and `bun run test` run the API and the website on your machine and need no Cloudflare account. The database they talk to is on Neon: `bun run dev` creates a project for your own stage and keeps it, and the stack test creates one and deletes it when it finishes.

## Database

The API stores every name it greets in Postgres, and `GET /greetings` reads the last ones back.

- `migrations/` holds the schema as numbered `.sql` files. Alchemy applies them with `pg`, which is why it is a dev dependency at the root; the Worker itself connects with Effect's own Postgres driver. The ones that have not run yet are applied, each in a transaction, whenever the stack starts or deploys. To change the schema, add a file; a file that has been applied cannot be edited.
- `apps/api/src/repos/greeting.ts` holds the queries, written with [Effect SQL](https://effect.website). Handlers call the repository and never see SQL.
- `apps/api/src/database.ts` declares the Neon project and the Hyperdrive connection in front of it, and `apps/api/src/worker.ts` binds that connection to the Worker.

Every stage has a Neon project of its own, in the region set in `apps/api/src/database.ts`. A project cannot change region later, so set it before the database holds data you want to keep.

## Deploying

Deploying needs Cloudflare credentials next to the Neon ones. Connect your account once:

```sh
bun alchemy profile edit --add Cloudflare
```

Then deploy, and tear down when you are done:

```sh
bun run deploy
bun run destroy
```

Each stage is its own copy of the stack: `bun run deploy --stage prod`. The first deploy also creates this project's state store on your account, a Worker named `{{name}}-state`, which is where Alchemy remembers what it deployed.
