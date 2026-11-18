# CI/CD

`.github/workflows/deploy.yml` checks every change, deploys `main` to the `prod` stage and gives each pull request a `pr-<n>` preview stage. Its Cloudflare token is minted by `stacks/github.ts`, a stack of its own that is deployed by hand. When `alchemy.run.ts` gains a resource of another Cloudflare product, add its permission group there and say that the stack needs a re-deploy.
