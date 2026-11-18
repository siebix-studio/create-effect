import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import { Effect, Layer, Redacted } from "effect";

// The GitHub repository the workflow runs in. Fill this in before deploying this stack.
const repository = { owner: "your-github-user", repository: "{{name}}" };

/**
 * CI credentials as code: mints the scoped Cloudflare API token the deploy workflow uses and
 * stores it, with the account ID, as GitHub Actions secrets. Minting a token needs token-write
 * rights, so deploy this once from a laptop under an `admin` profile:
 *
 *   bun alchemy deploy --config stacks/github.ts --stage prod --profile admin
 *
 * Re-deploy it (same stage, so it updates the same token) only to rotate the token or change
 * its permissions.
 */
export default Alchemy.Stack(
  "{{pascalName}}GitHub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    // The store alchemy.run.ts uses for deployed stages.
    state: Cloudflare.state({ workerName: "{{name}}-state" }),
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          // What the stack in alchemy.run.ts deploys. A resource of another Cloudflare product
          // (KV, R2, D1, Queues) needs its permission group added here, and this stack re-deployed.
          permissionGroups: [
            "Workers Scripts Write",
            "Workers Tail Read",
            "Account Settings Write",
            // `Cloudflare.state()` keeps its bearer token in the Secrets Store and binds it on
            // every run, which takes Write rather than Read.
            "Secrets Store Write",
          ],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    });

    yield* GitHub.Secret("CloudflareApiToken", {
      ...repository,
      name: "CLOUDFLARE_API_TOKEN",
      value: apiToken.value,
    });

    yield* GitHub.Secret("CloudflareAccountId", {
      ...repository,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId),
    });
  })
);
