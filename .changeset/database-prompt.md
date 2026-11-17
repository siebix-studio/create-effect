---
"@siebix/create-effect": minor
---

`create-effect` now asks whether to add a database, and `--database d1|neon|none` answers it up front. With D1 or Neon Postgres, the new project's API stores every name it greets and `GET /greetings` reads the last ones back: there is a migration in `migrations/`, a repository written in Effect SQL, and tests for both. D1 runs on your machine under `bun run dev` and `bun run test`. Neon is reached through Hyperdrive and is a real Neon project in development too, so it needs a Neon account from the first run. Without a flag, and with `--yes`, no database is added, as before.
