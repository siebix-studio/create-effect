---
"@siebix/create-effect": minor
---

`create-effect` now asks whether to add a database, and `--database d1|neon|none` answers it up front. With D1 or Neon Postgres, the new project's API stores every name it greets and `GET /greetings` reads the last ones back: there is a migration in `migrations/`, a repository written in Effect SQL, and tests for both. D1 runs on your machine under `bun run dev` and `bun run test`. Neon is reached through Hyperdrive and is a real Neon project in development too, so it needs a Neon account from the first run. Without a flag, and with `--yes`, no database is added, as before. `create-effect add d1` and `add neon` add a database to a project created earlier. New projects keep the stack's providers in `providers.ts`, where Neon is registered; a project from an earlier version needs that file before `add neon` works, and the command says so.
