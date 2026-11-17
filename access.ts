import * as Cloudflare from "@alchemy.run/cloudflare";

import { SiebixDomain } from "./domain";

/** Gates every non-prod stage to @siebix.com addresses. */
export const TeamAccess = Cloudflare.Access.Application("TeamAccess", {
  type: "self_hosted",
  policies: [{ decision: "allow", include: [{ emailDomain: SiebixDomain }] }],
});
