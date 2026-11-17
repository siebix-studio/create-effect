import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TeamAccess } from "./access";
import { stageDomain } from "./domain";
import { EffectScaffoldState } from "./state";

export const Web = Cloudflare.Website.Foldkit(
  "Web",
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    const rootDir = `${import.meta.dirname}/apps/web`;

    // `alchemy dev` (`dev_<user>`) runs locally, so there's no deployed site to gate.
    if (stage.startsWith("dev_")) {
      return { rootDir };
    }

    // Only the custom domain serves prod; the workers.dev URL would be a duplicate for search engines.
    if (stage === "prod") {
      return { rootDir, domain: stageDomain(stage), workersDev: false };
    }

    return { rootDir, domain: stageDomain(stage), access: TeamAccess };
  })
);

// GitHub is only used for the comment on pull request previews, so only `pr-<n>` stages register
// it. Every other stage deploys and runs `alchemy dev` without a GitHub login.
const providers = Layer.unwrap(
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    return stage.startsWith("pr-")
      ? Layer.mergeAll(Cloudflare.providers(), GitHub.providers())
      : Cloudflare.providers();
  })
);

export default Alchemy.Stack(
  "EffectScaffold",
  {
    providers,
    state: EffectScaffoldState,
  },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    const web = yield* Web;
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
          | Site | ${web.url} |
          | Commit | ${commit} |

          Stage \`${stage}\`, visible to @siebix.com addresses. Destroyed when this pull request closes.
        `,
        issueNumber: github.pr,
        owner: github.owner,
        repository: github.repository,
      });
    }

    return { url: web.url.as<string>() };
  })
);
