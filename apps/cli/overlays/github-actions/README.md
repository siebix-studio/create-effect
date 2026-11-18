## CI/CD

`.github/workflows/deploy.yml` checks every change, deploys `main` to the `prod` stage, and deploys each pull request to its own `pr-<n>` stage, which is destroyed when the pull request closes. Each preview gets a comment on its pull request with the URLs. Previews are served on public `workers.dev` addresses.

The workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the repository's secrets. `stacks/github.ts` creates both, so nothing is pasted into GitHub by hand:

1. Push the project to a GitHub repository, and fill in its owner and name at the top of `stacks/github.ts`.
2. Create an `admin` profile. Minting an API token takes more rights than deploying, so this profile is only for this stack:

   ```sh
   bun alchemy profile create admin
   bun alchemy profile edit --profile admin
   ```

   Add Cloudflare and GitHub. For Cloudflare, choose "API Token or API Key", since its OAuth login cannot manage API tokens, and use the Global API Key or a token with "API Tokens Write" on the account.

3. Deploy the stack once:

   ```sh
   bun alchemy deploy --config stacks/github.ts --stage prod --profile admin
   ```

Re-deploy it only to rotate the token or to change its permissions. The token can deploy what `alchemy.run.ts` holds today; a resource of another Cloudflare product (KV, R2, D1, Queues) needs its permission group added in `stacks/github.ts` first.
