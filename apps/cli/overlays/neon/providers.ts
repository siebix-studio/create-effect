import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Neon from "@alchemy.run/neon";
import { Layer } from "effect";

export const providers = Layer.mergeAll(
  Cloudflare.providers(),
  // Each provider layer builds what it needs itself.
  // oxlint-disable-next-line effecttsgo/layer-merge-all-with-dependencies
  Neon.providers()
);
