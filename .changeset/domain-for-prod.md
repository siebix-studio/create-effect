---
"@siebix/create-effect": minor
---

New question, and its `--domain` flag: name a domain that is on your Cloudflare account, and the `prod` stage serves the website from it and the API from `/api` on the same origin. The hostname is kept in the project's new `domain.ts` and can be filled in there later. Without one, and with `--yes`, every stage stays on workers.dev as before. Every path of a new project's API now starts with `/api`. `add d1`, `add neon` and `add better-auth` build on `domain.ts`, so they refuse a project from an earlier version and say which file it needs.
