# create-effect

Create a full-stack [Effect](https://effect.website) app on Cloudflare with one command.

```sh
bunx @siebix/create-effect
```

It asks for a project name, whether to install dependencies and whether to initialize git, then writes a project you can run straight away:

```sh
cd my-app
bun run dev
```

It runs on [Bun](https://bun.sh), and so does the project it creates.

## What you get

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | An Effect HTTP API on a Cloudflare Worker |
| `apps/web` | A prerendered [Foldkit](https://foldkit.dev) website that calls the API through a typed client |
| `alchemy.run.ts` | The [Alchemy](https://alchemy.run) stack that deploys both |

- **One typed contract.** The website's client is derived from the contract the API implements. Change one side and the other stops compiling.
- **The whole stack on your machine.** `bun run dev` and `bun run test` start the API and the website locally. Neither needs a Cloudflare account.
- **Tooling that is already set up.** Ultracite, oxlint with Effect rules, oxfmt and effect-tsgo, passing from the first commit.
- **Ready for agents.** An `AGENTS.md`, and an `.mcp.json` that lets an agent inspect the running website through the Foldkit DevTools.

## Options

Every question has a flag, and a flag skips its question.

| Flag | What |
| --- | --- |
| `--install`, `--no-install` | Run `bun install`, or don't |
| `--git`, `--no-git` | Create a git repository with a first commit, or don't |
| `--github-actions` | Add a GitHub Actions workflow that deploys `main` and previews each pull request. Never asked for |
| `--force` | Write into a directory that is not empty without asking |
| `--yes`, `-y` | Ask nothing and take every default; a missing name becomes `my-app` |

```sh
bunx @siebix/create-effect my-app --yes
```

Where nothing can be asked, such as in CI, the defaults apply and the name has to be given.

### Deploying from GitHub

`--github-actions` adds `.github/workflows/deploy.yml`: it checks every change, deploys `main` to the `prod` stage, and gives each pull request a preview stage with a comment linking to it, destroyed when the pull request closes. It is opt-in because it needs Cloudflare credentials in GitHub. The project comes with `stacks/github.ts`, which creates a scoped token and stores it as repository secrets; its README walks through it.

A project created without the flag can get the workflow later. Run this inside it:

```sh
bunx @siebix/create-effect add github-actions
```

It writes the same files the flag would have, merges what it needs into `package.json` and the README, and runs `bun install` (`--no-install` to skip). A file you have changed since the project was created is left as it is, and you are pointed to what it would have become. `--directory` names a project somewhere else.

## Links

- Website: [effect.siebix.com](https://effect.siebix.com)
- Source and issues: [github.com/siebix-studio/create-effect](https://github.com/siebix-studio/create-effect)

Built by [Siebix](https://siebix.com). Released under the [MIT license](https://github.com/siebix-studio/create-effect/blob/main/LICENSE).
