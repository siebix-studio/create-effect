# @siebix/create-effect

## 0.4.0

### Minor Changes

- [#8](https://github.com/siebix-studio/create-effect/pull/8) [`2832d24`](https://github.com/siebix-studio/create-effect/commit/2832d247f0e2b931823cd0813a2f0558e0afb787) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - `create-effect` now asks whether to add a database, and `--database d1|neon|none` answers it up front. With D1 or Neon Postgres, the new project's API stores every name it greets and `GET /greetings` reads the last ones back: there is a migration in `migrations/`, a repository written in Effect SQL, and tests for both. D1 runs on your machine under `bun run dev` and `bun run test`. Neon is reached through Hyperdrive and is a real Neon project in development too, so it needs a Neon account from the first run. Without a flag, and with `--yes`, no database is added, as before. `create-effect add d1` and `add neon` add a database to a project created earlier. New projects keep the stack's providers in `providers.ts`, where Neon is registered; a project from an earlier version needs that file before `add neon` works, and the command says so.

- [#12](https://github.com/siebix-studio/create-effect/pull/12) [`df2f0fd`](https://github.com/siebix-studio/create-effect/commit/df2f0fd0d5c6f757043c8a000977390dca7e93a0) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - Each run that creates a project or adds a feature is now counted, and the [website](https://effect.siebix.com) shows how many projects were created and with which options. A run reports the options that were chosen, the version of the CLI and the operating system. It never reports the project's name or a path, and the CLI says so whenever it reports. `DO_NOT_TRACK=1` or `CREATE_EFFECT_TELEMETRY=0` turns it off, and nothing is reported from CI.

## 0.3.0

### Minor Changes

- [#10](https://github.com/siebix-studio/create-effect/pull/10) [`e94d7e6`](https://github.com/siebix-studio/create-effect/commit/e94d7e622f9981f891edd16b4250391c425d903c) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - New `add` command: `bunx @siebix/create-effect add github-actions`, run inside a project created earlier, adds the deploy workflow that `--github-actions` would have written. Files changed since the project was created are left as they are. Every project now has a `create-effect.json` that records which features it has, so `add` knows when there is nothing left to add.

- [#10](https://github.com/siebix-studio/create-effect/pull/10) [`5892c3e`](https://github.com/siebix-studio/create-effect/commit/5892c3e81480f6a27db8fb73d6c9f0c74e2910b6) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - The API Worker of a new project now provides `Cloudflare.Telemetry()`: deployed stages get Workers Logs and Traces in the Cloudflare dashboard, with Effect spans in each request's trace. The Worker pins compatibility date `2026-08-25`, which native tracing needs.

- [#10](https://github.com/siebix-studio/create-effect/pull/10) [`e94d7e6`](https://github.com/siebix-studio/create-effect/commit/e94d7e622f9981f891edd16b4250391c425d903c) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - A new project now has an `.mcp.json` for the Foldkit DevTools MCP server, so coding agents can inspect the running website: its Model, its Message history and past states.

- [#10](https://github.com/siebix-studio/create-effect/pull/10) [`e94d7e6`](https://github.com/siebix-studio/create-effect/commit/e94d7e622f9981f891edd16b4250391c425d903c) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - New question, and its `--github-actions` flag: answer yes (the default is no) and the project gets a GitHub Actions workflow that checks every change, deploys `main` to the `prod` stage and gives each pull request its own preview stage with a comment linking to it. It comes with `stacks/github.ts`, which mints the scoped Cloudflare token the workflow needs and stores it as repository secrets.

## 0.2.0

### Minor Changes

- [#7](https://github.com/siebix-studio/create-effect/pull/7) [`b0297a2`](https://github.com/siebix-studio/create-effect/commit/b0297a2fe84c0b8058f098b0c8fafbf96e91e540) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - New projects come with a lefthook pre-commit hook that runs `ultracite fix` on staged files. It is installed by `bun install` when the project is a git repository.

  They also ship the `.vscode/settings.json` Ultracite sets up, so VS Code formats on save and fixes lint issues with the Oxc extension.

## 0.1.1

### Patch Changes

- [#4](https://github.com/siebix-studio/create-effect/pull/4) [`9f5da03`](https://github.com/siebix-studio/create-effect/commit/9f5da031f6f9de0a42430d0f5f537c94ebafd3ea) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - The package now has a README, keywords, and links to the website, the source and Siebix, so its page on npm says what it is and how to use it.

## 0.1.0

### Minor Changes

- [#1](https://github.com/siebix-studio/create-effect/pull/1) [`966e6f0`](https://github.com/siebix-studio/create-effect/commit/966e6f047f0b6fe0a7ccebaa38f4ba3cf65d2241) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - `create-effect <name>` now creates a project: a Bun workspace with an Effect HTTP API on a Cloudflare Worker, a prerendered Foldkit website that calls it through a typed client, the contract both share, and an Alchemy stack that deploys them. `bun run dev` and `bun run test` in the new project run the whole stack locally, with no Cloudflare account. It asks for the project name, whether to install dependencies and whether to initialize git; `--install`/`--no-install`, `--git`/`--no-git` and `--force` answer a question up front, and `--yes` takes every default.
