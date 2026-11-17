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

## Options

Every question has a flag, and a flag skips its question.

| Flag | What |
| --- | --- |
| `--install`, `--no-install` | Run `bun install`, or don't |
| `--git`, `--no-git` | Create a git repository with a first commit, or don't |
| `--force` | Write into a directory that is not empty without asking |
| `--yes`, `-y` | Ask nothing and take every default; a missing name becomes `my-app` |

```sh
bunx @siebix/create-effect my-app --yes
```

Where nothing can be asked, such as in CI, the defaults apply and the name has to be given.

## Links

- Website: [effect.siebix.com](https://effect.siebix.com)
- Source and issues: [github.com/siebix-studio/create-effect](https://github.com/siebix-studio/create-effect)

Built by [Siebix](https://siebix.com). Released under the [MIT license](https://github.com/siebix-studio/create-effect/blob/main/LICENSE).
