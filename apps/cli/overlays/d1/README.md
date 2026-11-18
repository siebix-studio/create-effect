## Database

The API stores every name it greets in [D1](https://developers.cloudflare.com/d1/), Cloudflare's SQLite, and `GET /api/greetings` reads the last ones back. Under `bun run dev` and `bun run test` the database runs on your machine with the rest.

- `migrations/` holds the schema as numbered `.sql` files. The ones that have not run yet are applied whenever the stack starts or deploys. To change the schema, add a file; a file that has been applied cannot be edited.
- `apps/api/src/repos/greeting.ts` holds the queries, written with [Effect SQL](https://effect.website). Handlers call the repository and never see SQL.
- `apps/api/src/database.ts` declares the database, and `apps/api/src/worker.ts` binds it to the Worker.

D1 has no transactions that span statements. For writes that must succeed or fail together, use `batch` on the binding.

With the deploy workflow, the token from `stacks/github.ts` has to be allowed to manage D1: add `"D1 Write"` to its `permissionGroups` and deploy that stack again.
