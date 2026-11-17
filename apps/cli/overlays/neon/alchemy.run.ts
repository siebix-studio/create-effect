import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Neon from "@alchemy.run/neon";
import * as Alchemy from "alchemy";
import { Effect, Layer } from "effect";

import { Database, Hyperdrive } from "./apps/api/src/database.ts";
import Api from "./apps/api/src/worker.ts";

// Local stages (`alchemy dev`, the integration test) keep their state on disk and need no
// Cloudflare account, only a Neon one. Deployed stages share this project's own state store.
const state = Layer.unwrap(
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return stage.startsWith("dev_") || stage.startsWith("test_")
      ? Alchemy.localState()
      : Cloudflare.state({ workerName: "{{name}}-state" });
  })
);

export default Alchemy.Stack(
  "{{pascalName}}",
  {
    // Each provider layer builds everything it needs itself; merging them is what Alchemy documents.
    // oxlint-disable-next-line effecttsgo/layer-merge-all-with-dependencies
    providers: Layer.mergeAll(Cloudflare.providers(), Neon.providers()),
    state,
  },
  Effect.gen(function* () {
    yield* Database;
    yield* Hyperdrive;
    const api = yield* Api;

    const web = yield* Cloudflare.Website.Foldkit("Web", {
      rootDir: `${import.meta.dirname}/apps/web`,
      env: { VITE_API_URL: api.url.as<string>() },
      dev: { port: 5173 },
    });

    return { api: api.url.as<string>(), web: web.url.as<string>() };
  })
);
