# Database

The API stores its data in a Neon Postgres database, reached through Hyperdrive. Both are declared in `apps/api/src/database.ts`, the connection is bound in `apps/api/src/worker.ts`, and `providers.ts` registers Neon.

- The database is always a real Neon project, one per stage, so `bun run dev` and `bun run test` need Neon credentials (`bun alchemy profile edit --add Neon`, or `NEON_API_KEY` in CI). The stack test creates a project and deletes it afterwards.
- SQL lives in a repository under `apps/api/src/repos`, one file per table, imported as a namespace (`import * as GreetingRepo from "./repos/greeting.ts"`). A repository is a service written against `SqlClient` from `effect/sql`; it fails with its own `PersistenceError`, never with an HTTP status. Handlers call repositories and hold no SQL, and their tests replace the repository with a stand-in.
- A schema change is a new file in `migrations/`, numbered after the last one. Never edit a migration that has been applied; the next deploy would refuse it.
- `test/integ.test.ts` is what runs the real SQL, against Neon.
