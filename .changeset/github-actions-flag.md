---
"@siebix/create-effect": minor
---

New question, and its `--github-actions` flag: answer yes (the default is no) and the project gets a GitHub Actions workflow that checks every change, deploys `main` to the `prod` stage and gives each pull request its own preview stage with a comment linking to it. It comes with `stacks/github.ts`, which mints the scoped Cloudflare token the workflow needs and stores it as repository secrets.
