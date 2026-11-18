import * as Cloudflare from "@alchemy.run/cloudflare";

// Where the stack's resources come from. `alchemy.run.ts` and `test/integ.test.ts` both read
// this, so a resource of another provider is registered here once.
export const providers = Cloudflare.providers();
