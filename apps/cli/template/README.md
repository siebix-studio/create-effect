# {{name}}

A full-stack Effect app on Cloudflare, deployed with [Alchemy](https://alchemy.run). Created with [create-effect](https://effect.siebix.com) by [Siebix](https://siebix.com).

## Layout

| Path | What |
| --- | --- |
| `packages/domain` | Schemas and the HTTP contract shared by the API and the website |
| `apps/api` | The Effect HTTP API, a Cloudflare Worker |
| `apps/web` | The website, a prerendered [Foldkit](https://foldkit.dev) app |
| `alchemy.run.ts` | The stack that deploys both |
| `domain.ts` | The domain `prod` is served from, if it has one |

`create-effect.json` records what was generated. Keep it: `bunx @siebix/create-effect add <feature>` reads it to add a deploy workflow (`github-actions`) or a database (`d1`, `neon`) later.

## Development

```sh
bun run dev         # the API (localhost:1337) and the website (localhost:5173), under alchemy dev
bun run check       # lint and format (ultracite)
bun run fix         # apply lint and format fixes
bun run typecheck   # the stack file, then every workspace
bun run test        # API tests, Foldkit scene tests, and a test of the whole stack
```

`bun run dev` and `bun run test` run everything on your machine. Neither needs a Cloudflare account.

A [lefthook](https://lefthook.dev) pre-commit hook runs `ultracite fix` on staged files. `bun install` sets it up once the project is a git repository; if you create the repository later, run `bunx lefthook install`.

In VS Code, install the [Oxc extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode); `.vscode/settings.json` formats on save and applies lint fixes with it.

## Agents

`AGENTS.md` tells coding agents how the project is laid out. `.mcp.json` gives them the [Foldkit DevTools](https://foldkit.dev/ai/mcp): with `bun run dev` running and the website open in a browser tab, an agent can read the website's Model and Message history, replay past states and dispatch Messages. Agents that read `.mcp.json`, such as Claude Code, pick it up when they start in this folder.

The tools return whatever is in the Model, so keep credentials out of it. To switch them off, set `devToolsMcpPort: false` in the `foldkit()` options in `apps/web/vite.config.ts`.

## Deploying

Deploying needs Cloudflare credentials. Connect your account once:

```sh
bun alchemy profile edit --add Cloudflare
```

Then deploy, and tear down when you are done:

```sh
bun run deploy
bun run destroy
```

Each stage is its own copy of the stack: `bun run deploy --stage prod`. The first deploy also creates this project's state store on your account, a Worker named `{{name}}-state`, which is where Alchemy remembers what it deployed.

## Domain

Every stage is served from `workers.dev`, where the website and the API each have an address of their own. `domain.ts` can name a domain for the `prod` stage:

```ts
const DOMAIN = "example.com";
```

`bun run deploy --stage prod` then serves the website from that hostname and the API from `/api` on it, so the two share one origin. Every other stage, and `bun run dev`, stays as it is.

The hostname has to be on a zone of the Cloudflare account you deploy to: add the domain to Cloudflare first. Alchemy looks the zone up by name, creates the DNS record and attaches the certificate. A subdomain works too (`app.example.com`).

If the project has the deploy workflow, its token has to be allowed to do the same. Add a second policy to `policies` in `stacks/github.ts`, and deploy that stack again:

```ts
{
  effect: "allow",
  permissionGroups: ["Zone Read", "Workers Routes Write"],
  resources: {
    [`com.cloudflare.api.account.${accountId}`]: {
      "com.cloudflare.api.account.zone.*": "*",
    },
  },
},
```

## Observability

Deployed stages send Workers Logs and Traces to the Cloudflare dashboard (Workers & Pages → the `Api` Worker → Observability). Every `Effect.withSpan` in the API shows up as a span in the request's trace, next to Cloudflare's own fetch, KV, R2 and D1 spans. Nothing runs or is sent anywhere during `bun run dev` or `bun run test`.
