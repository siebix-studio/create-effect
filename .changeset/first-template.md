---
"@siebix/create-effect": minor
---

`create-effect <name>` now creates a project: a Bun workspace with an Effect HTTP API on a Cloudflare Worker, a prerendered Foldkit website that calls it through a typed client, the contract both share, and an Alchemy stack that deploys them. `bun run dev` and `bun run test` in the new project run the whole stack locally, with no Cloudflare account. It asks for the project name, whether to install dependencies and whether to initialize git; `--install`/`--no-install`, `--git`/`--no-git` and `--force` answer a question up front, and `--yes` takes every default.
