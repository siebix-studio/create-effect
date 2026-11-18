# Database

The API stores its data in a D1 database (SQLite), declared in `apps/api/src/database.ts` and bound in `apps/api/src/worker.ts`. It runs locally under `bun run dev` and `bun run test`.

- SQL lives in a repository under `apps/api/src/repos`, one file per table, imported as a namespace (`import * as GreetingRepo from "./repos/greeting.ts"`). A repository is a service written against `SqlClient` from `effect/sql`; it fails with its own `PersistenceError`, never with an HTTP status. Handlers call repositories and hold no SQL, and their tests replace the repository with a stand-in.
- A schema change is a new file in `migrations/`, numbered after the last one. Never edit a migration that has been applied; the next deploy would refuse it.
- D1 has no transactions across statements: `sql.withTransaction` does not work. Use `batch` on the D1 binding for writes that belong together.
- `test/integ.test.ts` is what runs the real SQL, against the local database.
