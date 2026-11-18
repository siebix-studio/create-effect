import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import { Config, Effect, Layer } from "effect";

import Api from "./apps/api/src/worker.ts";
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

// GitHub is only used for the comment on pull request previews, so only `pr-<n>` stages register
// it. Every other stage deploys and runs `alchemy dev` without a GitHub login.
const stageProviders = Layer.unwrap(
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return stage.startsWith("pr-")
      ? Layer.mergeAll(providers, GitHub.providers())
      : providers;
  })
);

export default Alchemy.Stack(
  "{{pascalName}}",
  { providers: stageProviders, state },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    const api = yield* Api;

    const web = yield* Cloudflare.Website.Foldkit("Web", {
      rootDir: `${import.meta.dirname}/apps/web`,
      env: { VITE_API_URL: api.url.as<string>() },
      dev: { port: 5173 },
    });

    const github = yield* GitHub.GitHubEnv;

    if (github?.pr !== undefined && stage.startsWith("pr-")) {
      const commit = yield* Config.String("BUILD_SHA").pipe(
        Config.withDefault(github.sha)
      );

      yield* GitHub.Comment("PreviewComment", {
        body: Output.interpolate`
          ## Preview deployed

          | | |
          | --- | --- |
          | Website | ${web.url} |
          | API | ${api.url} |
          | Commit | ${commit} |

          Stage \`${stage}\`. Destroyed when this pull request closes.
        `,
        issueNumber: github.pr,
        owner: github.owner,
        repository: github.repository,
      });
    }

    return { api: api.url.as<string>(), web: web.url.as<string>() };
  })
);
