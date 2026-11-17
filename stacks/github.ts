import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { EffectScaffoldState } from "../state";

const repository = { owner: "siebix-studio", repository: "effect-scaffold" };

/**
 * CI credentials as code: mints the scoped Cloudflare API token the deploy workflow uses and
 * stores it, with the account ID, as GitHub Actions secrets. Minting a token needs token-write
 * rights, so deploy this once from a laptop under the `admin` profile:
 *
 *   bun alchemy deploy --config stacks/github.ts --stage prod --profile admin
 *
 * Re-deploy it (same stage, so it updates the same token) only to rotate the token or change
 * its permissions.
 */
export default Alchemy.Stack(
  "EffectScaffoldGitHub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: EffectScaffoldState,
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;
    const account = `com.cloudflare.api.account.${accountId}`;

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers Scripts Write",
            "Workers Tail Read",
            "Account Settings Write",
            // `Cloudflare.state()` keeps its bearer token in the Secrets Store and binds it on
            // every run, which takes Write rather than Read.
            "Secrets Store Write",
            // "Access: Apps and Policies Write", account scope. The name also labels a zone-scoped
            // group, and the name shorthand resolves to that one.
            { id: "1e13c5124ca64b72b1969a67e8829049" },
          ],
          resources: { [account]: "*" },
        },
        {
          effect: "allow",
          // Looking up the siebix.com zone and attaching each stage's custom domain.
          permissionGroups: ["Zone Read", "Workers Routes Write"],
          resources: {
            [account]: { "com.cloudflare.api.account.zone.*": "*" },
          },
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
