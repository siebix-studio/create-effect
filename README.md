# create-effect

A CLI that scaffolds full-stack Effect apps on Cloudflare, deployed with [Alchemy](https://alchemy.run).

```sh
bunx @siebix/create-effect my-app
```

The project it creates is a Bun workspace:

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | An Effect HTTP API on a Cloudflare Worker |
| `apps/web` | A prerendered Foldkit website that calls the API through a typed client |
| `alchemy.run.ts` | The stack that deploys both |

With a database, the API also gets a migration, a repository written in Effect SQL and an endpoint that reads back what it stored. D1 runs on your machine with the rest; Neon is a real Neon project, also in development.

Run without arguments, it asks for the project name, which database to add, whether to install dependencies, whether to initialize git and whether to add a deploy workflow. Each question has a flag, and a flag skips its question:

| Flag | What |
| --- | --- |
| `--database d1\|neon\|none` | Add a D1 database, a Neon Postgres database, or none (the default) |
| `--install`, `--no-install` | Run `bun install`, or don't |
| `--git`, `--no-git` | Create a git repository with a first commit, or don't |
| `--github-actions`, `--no-github-actions` | Add a GitHub Actions workflow that deploys `main` and previews each pull request, or don't |
| `--force` | Write into a directory that is not empty without asking |
| `--yes`, `-y` | Ask nothing and take every default; a missing name becomes `my-app` |

Where nothing can be asked (CI, a pipe) the defaults apply, and the name has to be given.

`bunx @siebix/create-effect add github-actions`, run inside a project created earlier, adds what `--github-actions` would have written, and `add d1` or `add neon` adds a database to a project that has none. It leaves files that were changed since as they are.

## Telemetry

Each run that creates a project, or adds a feature to one, is counted, and the website shows the count. A run reports this and nothing else:

- whether it was `create` or `add`, and which features were chosen
- whether dependencies were installed, whether git was initialized, and whether a question was answered at the prompt
- the version of the CLI and the operating system (`darwin`, `linux`, `win32`)

It never reports the project's name, a path, or anything that identifies the user, and the API stores no IP address. `DO_NOT_TRACK=1` turns it off, and so does `CREATE_EFFECT_TELEMETRY=0`. Nothing is reported from CI, from this repository's tests, or by `bun run cli`.

## Layout

| Path | What |
| --- | --- |
| `apps/cli` | The CLI (`@siebix/create-effect`, binary `create-effect`), built with `effect/cli` |
| `apps/cli/template` | The project the CLI creates, copied as is with the project name filled in |
| `apps/cli/overlays` | What a flag adds to that project: `github-actions` holds the deploy workflow, and `database`, `d1` and `neon` a database |
| `apps/web` | The website at [effect.siebix.com](https://effect.siebix.com), a prerendered Foldkit app |
| `apps/api` | The API at `effect-api.siebix.com`: a Worker with one Durable Object that counts the CLI's runs |
| `alchemy.run.ts` | The deploy stack for the website and the API |
| `stacks/github.ts` | CI credentials (Cloudflare API token and account ID as GitHub secrets) |

## Development

```sh
bun install
bun run check       # lint and format (ultracite)
bun run typecheck   # stack files, then every app
bun run test        # every app's tests (one creates a project and runs its checks), then the stack's own
bun run cli -- my-app
bun run dev         # the website and the API under alchemy dev
```

## Deploying

Stages and where they are served:

| Stage | Website | API | Access to the website |
| --- | --- | --- | --- |
| `prod` | `effect.siebix.com` | `effect-api.siebix.com` | Public |
| `pr-<n>` | `effect-pr-<n>.siebix.com` | `effect-api-pr-<n>.siebix.com` | @siebix.com addresses (Cloudflare Access) |
| `dev_<user>` | Local, under `alchemy dev` | Local | — |

The API is public on every deployed stage. Each stage counts for itself, so a preview starts at zero and only `prod` holds the real numbers: the CLI reports to `effect-api.siebix.com`, and that address is in every copy of it that is installed. To try a change to the API with the real CLI, run `bun run dev` and point the CLI at it:

```sh
CREATE_EFFECT_TELEMETRY_URL=http://localhost:1337/events bun apps/cli/src/bin.ts my-app
```

`/stats` is cached for a minute at Cloudflare's edge and in browsers, and the website asks again every minute, so a new project shows up within about two minutes. The numbers live in the SQLite database of one Durable Object (`apps/api/src/usage.ts`): every event as it was received, and the counters the website reads. Destroying the `prod` stage deletes them.

## Releasing

Releases of `@siebix/create-effect` are driven by [Changesets](https://github.com/changesets/changesets).

1. A pull request that changes what users get adds a changeset: `bun changeset`, pick the bump, describe the change.
2. On `main`, CI collects the pending changesets into a "Version Packages" pull request that bumps the version and writes `apps/cli/CHANGELOG.md`.
3. Merging that pull request publishes the new version to npm, tags it and creates the GitHub release.

`bun run release` is what CI runs to publish. Bun packs the tarball, because it resolves the `catalog:` versions, and npm publishes it. `RELEASE_DRY_RUN=1 bun run release` shows the publish plan and the packed files without publishing.

CI publishes through npm trusted publishing, so no npm token is stored here. Two things are set up once for that:

- On npmjs.com, the package's settings name this repository and `ci.yml` as a trusted publisher, with direct `npm publish` allowed. npm configures this from the package's own page, so the very first version is published by hand: `npm login`, then `bun run release` on `main`.
- GitHub Actions is allowed to create pull requests, in the Actions settings of both the organization and the repository.

Pull requests opened by CI don't start workflow runs, so close and reopen the "Version Packages" pull request to get its checks.

## CI/CD

`.github/workflows/ci.yml` checks every change, deploys `main` to `prod`, releases the CLI (see above), and deploys each pull request to its own `pr-<n>` stage, which is destroyed when the pull request closes.

The workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the repository's secrets. `stacks/github.ts` creates both. Minting a token needs token-write rights, so deploy it once from a laptop with the `admin` profile:

```sh
bun alchemy deploy --config stacks/github.ts --stage prod --profile admin
```

## License

[MIT](LICENSE)
