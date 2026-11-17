import * as Cloudflare from "@alchemy.run/cloudflare";

/**
 * This project's own state store. A store only serves the Alchemy release that deployed it, and a
 * deploy with `--yes` redeploys any store on another version, so sharing the account's default
 * `alchemy-state-store` with other projects would make their deploys overwrite each other's store.
 */
export const EffectScaffoldState = Cloudflare.state({
  workerName: "effect-scaffold-state",
});
