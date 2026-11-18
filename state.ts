import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * This project's own state store. A store only serves the Alchemy release that deployed it, and a
 * deploy with `--yes` redeploys any store on another version, so sharing the account's default
 * `alchemy-state-store` with other projects would make their deploys overwrite each other's store.
 *
 * The integration test (`test_<user>`) keeps its state on disk, so it needs no Cloudflare account.
 */
export const EffectScaffoldState = Layer.unwrap(
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return stage.startsWith("test_")
      ? Alchemy.localState()
      : Cloudflare.state({ workerName: "effect-scaffold-state" });
  })
);
