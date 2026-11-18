import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Neon from "@alchemy.run/neon";
import { Layer } from "effect";

// Where the stack's resources come from. `alchemy.run.ts` and `test/integ.test.ts` both read
// this, so a resource of another provider is registered here once.
export const providers = Layer.mergeAll(
  Cloudflare.providers(),
  // Each provider layer builds everything it needs itself; merging them is what Alchemy documents.
  // oxlint-disable-next-line effecttsgo/layer-merge-all-with-dependencies
  Neon.providers()
);
