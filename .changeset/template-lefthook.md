---
"@siebix/create-effect": minor
---

New projects come with a lefthook pre-commit hook that runs `ultracite fix` on staged files. It is installed by `bun install` when the project is a git repository.

They also ship the `.vscode/settings.json` Ultracite sets up, so VS Code formats on save and fixes lint issues with the Oxc extension.
