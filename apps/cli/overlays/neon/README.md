## Database

The API stores every name it greets in a [Neon](https://neon.com) Postgres database, reached through [Hyperdrive](https://developers.cloudflare.com/hyperdrive/), and `GET /greetings` reads the last ones back.

The database is a real Neon project, also while you develop: Neon has no local stand-in. Create an API key in the [Neon Console](https://console.neon.tech) and store it once, before the first `bun run dev`:

```sh
bun alchemy profile edit --add Neon
```

`bun run dev` creates a Neon project for your own stage and keeps it. `bun run test` creates one for the stack test and deletes it when the test finishes, which takes a few minutes. Neither needs a Cloudflare account.

- `migrations/` holds the schema as numbered `.sql` files. Alchemy applies them with `pg`, which is why it is a dev dependency at the root; the Worker itself connects with Effect's own Postgres driver. The ones that have not run yet are applied, each in a transaction, whenever the stack starts or deploys. To change the schema, add a file; a file that has been applied cannot be edited.
- `apps/api/src/repos/greeting.ts` holds the queries, written with [Effect SQL](https://effect.website). Handlers call the repository and never see SQL.
- `apps/api/src/database.ts` declares the Neon project and the Hyperdrive connection in front of it, and `apps/api/src/worker.ts` binds that connection to the Worker.
- `providers.ts` registers Neon next to Cloudflare.

Every stage has a Neon project of its own, in the region set in `apps/api/src/database.ts`. A project cannot change region later, so set it before the database holds data you want to keep.

With the deploy workflow, GitHub needs Neon credentials too. Add a `NEON_API_KEY` repository secret and pass it in the `env` of the workflow's `test`, `deploy` and `cleanup` jobs. The token from `stacks/github.ts` also has to be allowed to manage Hyperdrive: add `"Hyperdrive Write"` to its `permissionGroups` and deploy that stack again.
