import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import { Effect, Layer } from "effect";

import Api from "./apps/api/src/worker.ts";
import { stageHostname } from "./domain.ts";
import { providers } from "./providers.ts";

// Local stages (`alchemy dev`, the integration test) keep their state on disk and need no
// Cloudflare account. Deployed stages share this project's own state store.
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
  { providers, state },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;
    const hostname = stageHostname(stage);

    const api = yield* Api;

    const web = yield* Cloudflare.Website.Foldkit("Web", {
      rootDir: `${import.meta.dirname}/apps/web`,
      dev: { port: 5173 },
      // On a hostname the website finds the API at /api of its own origin, and the workers.dev
      // address would only be a second copy of it. On workers.dev the API is another origin, so
      // the website is built with its address.
      ...(hostname === undefined
        ? { env: { VITE_API_URL: api.url.as<string>() } }
        : { domain: hostname, workersDev: false }),
    });

    return { api: api.url.as<string>(), web: web.url.as<string>() };
  })
);
