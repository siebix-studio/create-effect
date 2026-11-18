---
"@siebix/create-effect": minor
---

New `add` command: `bunx @siebix/create-effect add github-actions`, run inside a project created earlier, adds the deploy workflow that `--github-actions` would have written. Files changed since the project was created are left as they are. Every project now has a `create-effect.json` that records which features it has, so `add` knows when there is nothing left to add.
