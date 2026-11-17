# @siebix/create-effect

## 0.1.1

### Patch Changes

- [#4](https://github.com/siebix-studio/create-effect/pull/4) [`9f5da03`](https://github.com/siebix-studio/create-effect/commit/9f5da031f6f9de0a42430d0f5f537c94ebafd3ea) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - The package now has a README, keywords, and links to the website, the source and Siebix, so its page on npm says what it is and how to use it.

## 0.1.0

### Minor Changes

- [#1](https://github.com/siebix-studio/create-effect/pull/1) [`966e6f0`](https://github.com/siebix-studio/create-effect/commit/966e6f047f0b6fe0a7ccebaa38f4ba3cf65d2241) Thanks [@Siebe-Studio](https://github.com/Siebe-Studio)! - `create-effect <name>` now creates a project: a Bun workspace with an Effect HTTP API on a Cloudflare Worker, a prerendered Foldkit website that calls it through a typed client, the contract both share, and an Alchemy stack that deploys them. `bun run dev` and `bun run test` in the new project run the whole stack locally, with no Cloudflare account. It asks for the project name, whether to install dependencies and whether to initialize git; `--install`/`--no-install`, `--git`/`--no-git` and `--force` answer a question up front, and `--yes` takes every default.
