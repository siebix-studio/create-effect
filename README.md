# create-effect

A CLI that scaffolds full-stack Effect apps on Cloudflare, deployed with [Alchemy](https://alchemy.run). In development.

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

Run without arguments, it asks for the project name, whether to install dependencies and whether to initialize git. Each question has a flag, and a flag skips its question:

| Flag | What |
| --- | --- |
| `--install`, `--no-install` | Run `bun install`, or don't |
| `--git`, `--no-git` | Create a git repository with a first commit, or don't |
| `--force` | Write into a directory that is not empty without asking |
| `--yes`, `-y` | Ask nothing and take every default; a missing name becomes `my-app` |

Where nothing can be asked (CI, a pipe) the defaults apply, and the name has to be given.

## Layout

| Path | What |
| --- | --- |
| `apps/cli` | The CLI (`@siebix/create-effect`, binary `create-effect`), built with `effect/cli` |
| `apps/cli/template` | The project the CLI creates, copied as is with the project name filled in |
| `apps/web` | The website at [effect.siebix.com](https://effect.siebix.com), a prerendered Foldkit app |
| `alchemy.run.ts` | The deploy stack for the website |
| `stacks/github.ts` | CI credentials (Cloudflare API token and account ID as GitHub secrets) |

## Development

```sh
bun install
bun run check       # lint and format (ultracite)
bun run typecheck   # stack files, then every app
bun run test        # CLI tests (one creates a project and runs its checks) and Foldkit scene tests
bun run cli -- my-app
bun run dev         # the website under alchemy dev
```

## Deploying

Stages and where they are served:

| Stage | URL | Access |
| --- | --- | --- |
| `prod` | `effect.siebix.com` | Public |
| `pr-<n>` | `effect-pr-<n>.siebix.com` | @siebix.com addresses (Cloudflare Access) |
| `dev_<user>` | Local, under `alchemy dev` | — |

## Releasing

Releases of `@siebix/create-effect` are driven by [Changesets](https://github.com/changesets/changesets).

1. A pull request that changes what users get adds a changeset: `bun changeset`, pick the bump, describe the change.
2. On `main`, CI collects the pending changesets into a "Version Packages" pull request that bumps the version and writes `apps/cli/CHANGELOG.md`.
3. Merging that pull request publishes the new version to npm, tags it and creates the GitHub release.

`bun run release` is what CI runs to publish. Bun packs the tarball, because it resolves the `catalog:` versions, and npm publishes it. `RELEASE_DRY_RUN=1 bun run release` shows the publish plan and the packed files without publishing.

The CLI is still `"private": true` in `apps/cli/package.json`, so nothing is published yet; changesets and version pull requests already work. Before removing that line:

- Add `@siebix/create-effect` on npmjs.com with this repository and `ci.yml` as its trusted publisher. No npm token is stored here.
- Allow GitHub Actions to create pull requests (repository settings, Actions, General).

Removing the line publishes the current version on the next push to `main`. Pull requests opened by CI don't start workflow runs, so close and reopen the "Version Packages" pull request to get its checks.

## CI/CD

`.github/workflows/ci.yml` checks every change, deploys `main` to `prod`, releases the CLI (see above), and deploys each pull request to its own `pr-<n>` stage, which is destroyed when the pull request closes.

The workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the repository's secrets. `stacks/github.ts` creates both. Minting a token needs token-write rights, so deploy it once from a laptop with the `admin` profile:

```sh
bun alchemy deploy --config stacks/github.ts --stage prod --profile admin
```
