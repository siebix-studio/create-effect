import {
  Array,
  Duration,
  Effect,
  Number,
  Option,
  Record,
  Schema,
  Stream,
  pipe,
} from "effect";
import { HttpApiClient } from "effect/http-api";
import { AsyncData, Command, Dom, Http, Subscription } from "foldkit";
import type { Runtime, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";

import { Api, Stats } from "../../api/src/contract";
import * as Changelog from "./changelog";
import { AppRoute, changelogRouter, homeRouter, urlToAppRoute } from "./route";
import {
  INSTALL_COMMAND,
  REPOSITORY_URL,
  SIEBIX_URL,
  SITE_NAME,
  SITE_URL,
  TAGLINE,
} from "./site";
import {
  CODE_BLOCK_CLASS,
  INLINE_CODE_CLASS,
  LINK_CLASS,
  SECTION_HEADING_CLASS,
} from "./ui";

// MODEL

export const UsageAsyncData = AsyncData.Schema(Stats, Schema.String);

export const Model = Schema.Struct({
  route: AppRoute,
  usage: UsageAsyncData.schema,
  /** The project count on screen, which runs up to the real one. */
  shownProjects: Schema.Finite,
  isReducedMotion: Schema.Boolean,
});

export type Model = typeof Model.Type;

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  SettledFetchUsage: { result: Schema.Result(Stats, Schema.String) },
  TickedRefreshUsage: {},
  TickedCountUp: { deltaTime: Schema.Finite },
  ChangedReducedMotion: { isReducedMotion: Schema.Boolean },
});

export type Message = typeof Message.Type;

// COMMAND

export const FetchUsage = Command.define("FetchUsage", {
  messages: [Message.SettledFetchUsage],
  execute: Effect.gen(function* () {
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: import.meta.env.VITE_API_URL,
    });

    return yield* client.usage.stats();
  }).pipe(
    Effect.mapError(() => "The API could not be reached."),
    Effect.result,
    Effect.map((result) => Message.SettledFetchUsage({ result })),
    Effect.provide(Http.layer)
  ),
});

const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) =>
    pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
});

const LoadExternal = Command.define("LoadExternal", {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
});

// INIT

// NOTE: Prerendering runs no Commands, so the numbers are fetched in the browser.
export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: {
    route: urlToAppRoute(url),
    usage: UsageAsyncData.Loading(),
    shownProjects: 0,
    // Nothing moves until the browser says motion is welcome.
    isReducedMotion: true,
  },
  commands: [FetchUsage()],
});

// UPDATE

type UpdateReturn = Update.Return<Model, Message>;

const USAGE_REFRESH_INTERVAL = Duration.seconds(60);

/** The count covers about two thirds of what is left in this time. */
const COUNT_UP_TIME_CONSTANT_MS = 150;

// A tab that was hidden reports one very long frame when it comes back.
const MAX_FRAME_MS = 32;

const maybeProjects = (model: Model): Option.Option<number> =>
  Option.map(AsyncData.getData(model.usage), (stats) => stats.projects);

const isCountingUp = (model: Model): boolean =>
  !model.isReducedMotion &&
  Option.exists(
    maybeProjects(model),
    (projects) => projects !== model.shownProjects
  );

const countUp = (shown: number, projects: number, deltaTime: number) => {
  const elapsed = Math.min(deltaTime, MAX_FRAME_MS);

  const next =
    shown +
    (projects - shown) * (1 - Math.exp(-elapsed / COUNT_UP_TIME_CONSTANT_MS));

  return Math.abs(projects - next) < 1 ? projects : next;
};

/** With reduced motion the count is simply the real one. */
const withoutCountUp = (model: Model): Model =>
  model.isReducedMotion
    ? modifyFields(model, {
        shownProjects: (shown) =>
          Option.getOrElse(maybeProjects(model), () => shown),
      })
    : model;

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),
    ChangedUrl: ({ url }) => ({
      model: modifyFields(model, { route: () => urlToAppRoute(url) }),
    }),
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    SettledFetchUsage: ({ result }) => ({
      model: withoutCountUp(
        modifyFields(model, { usage: AsyncData.settle(result) })
      ),
    }),
    TickedRefreshUsage: () =>
      Option.match(AsyncData.revalidateOrLoad(model.usage), {
        onNone: () => ({ model }),
        onSome: (usage) => ({
          model: modifyFields(model, { usage: () => usage }),
          commands: [FetchUsage()],
        }),
      }),
    TickedCountUp: ({ deltaTime }) => ({
      model: Option.match(maybeProjects(model), {
        onNone: () => model,
        onSome: (projects) =>
          modifyFields(model, {
            shownProjects: (shown) => countUp(shown, projects, deltaTime),
          }),
      }),
    }),
    ChangedReducedMotion: ({ isReducedMotion }) => ({
      model: withoutCountUp(
        modifyFields(model, { isReducedMotion: () => isReducedMotion })
      ),
    }),
  });

// SUBSCRIPTION

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  refreshUsage: entry(
    { isHome: Schema.Boolean },
    {
      modelToDependencies: (model) => ({
        isHome: model.route._tag === "Home",
      }),
      dependenciesToStream: ({ isHome }) =>
        Stream.when(
          // NOTE: Stream.tick emits once immediately, and init already fetched.
          Stream.tick(USAGE_REFRESH_INTERVAL).pipe(
            Stream.drop(1),
            Stream.map(Message.TickedRefreshUsage)
          ),
          Effect.sync(() => isHome)
        ),
    }
  ),
  countUp: Subscription.animationFrameEntry({
    isActive: isCountingUp,
    toMessage: (deltaTime) => Message.TickedCountUp({ deltaTime }),
  }),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: "(prefers-reduced-motion: reduce)",
      mapMatches: (isReducedMotion) =>
        Message.ChangedReducedMotion({ isReducedMotion }),
    })
  ),
}));

// VIEW

const SESSION = [
  "? Project name (my-app) › shop",
  "? Install dependencies with bun? › yes",
  "? Initialize a git repository? › yes",
  "? Add a GitHub Actions workflow that deploys it? › no",
  "",
  "✔ Created shop",
  "✔ Initialized a git repository",
  "✔ Installed dependencies",
  "",
  "  cd shop",
  "  bun run dev",
].join("\n");

type Feature = Readonly<{ title: string; description: string }>;

const FEATURES: ReadonlyArray<Feature> = [
  {
    title: "An Effect API on a Cloudflare Worker",
    description:
      "Endpoints declared with HttpApi, so every request is validated against a schema before your handler runs.",
  },
  {
    title: "A Foldkit website",
    description:
      "Prerendered at build time, hydrated in the browser, and written in the Elm architecture on top of Effect.",
  },
  {
    title: "One typed contract",
    description:
      "The website's client is derived from the contract the API implements. Change one side and the other stops compiling.",
  },
  {
    title: "The whole stack on your machine",
    description:
      "bun run dev and bun run test start the API and the website locally. Neither needs a Cloudflare account.",
  },
  {
    title: "Deployed with Alchemy",
    description:
      "One stack file deploys both to Cloudflare, and every stage is its own copy.",
  },
  {
    title: "A deploy workflow when you want one",
    description:
      "Say yes, and a GitHub Actions workflow deploys main and gives every pull request its own preview. create-effect add github-actions brings it to a project you already have.",
  },
  {
    title: "Logs and traces",
    description:
      "Deployed stages send Workers Logs and Traces to the Cloudflare dashboard, with every Effect span in its request's trace.",
  },
  {
    title: "Ready for coding agents",
    description:
      "An AGENTS.md that explains the project, and an .mcp.json that lets an agent inspect the running website through the Foldkit DevTools.",
  },
  {
    title: "Tooling that is already set up",
    description:
      "Ultracite, oxlint with Effect rules, oxfmt, effect-tsgo and a pre-commit hook, passing from the first commit.",
  },
];

const ROADMAP: ReadonlyArray<string> = [
  "A database: D1 or Neon Postgres",
  "Sign-in with better-auth",
];

const COUNT_FORMAT = new Intl.NumberFormat("en");

const formatProjects = (projects: number): string =>
  `${COUNT_FORMAT.format(projects)} ${projects === 1 ? "project" : "projects"}`;

// NOTE: The line keeps its height, so the page does not move when the numbers arrive.
const projectCountView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.p(
    [h.Class("min-h-5 text-sm text-neutral-500 tabular-nums")],
    pipe(
      maybeProjects(model),
      Option.filter((projects) => projects > 0),
      Option.match({
        onNone: () => [],
        onSome: () => [
          `${formatProjects(Math.round(model.shownProjects))} created so far.`,
        ],
      })
    )
  );

const heroView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class("grid gap-6")],
    [
      h.h1(
        [h.Class("text-5xl leading-none text-balance sm:text-7xl")],
        [SITE_NAME]
      ),
      h.p(
        [h.Class("max-w-xl text-lg text-balance text-neutral-600")],
        [`${TAGLINE}.`]
      ),
      h.pre([h.Class(CODE_BLOCK_CLASS)], [h.code([], [INSTALL_COMMAND])]),
      projectCountView(model, h),
      h.nav(
        [h.Class("flex flex-wrap gap-x-6 gap-y-2 text-neutral-600")],
        [
          h.a(
            [h.Href(REPOSITORY_URL), h.Class(LINK_CLASS)],
            ["View the source on GitHub"]
          ),
          h.a(
            [h.Href(changelogRouter()), h.Class(LINK_CLASS)],
            ["Read the changelog"]
          ),
        ]
      ),
    ]
  );

const sessionView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-6")],
    [
      h.h2([h.Class(SECTION_HEADING_CLASS)], ["Four questions"]),
      h.p(
        [h.Class("max-w-xl text-pretty text-neutral-600")],
        [
          "It asks what it needs to know and nothing else. Every question has a flag, and ",
          h.code([h.Class(INLINE_CODE_CLASS)], ["--yes"]),
          " takes every default.",
        ]
      ),
      h.pre([h.Class(CODE_BLOCK_CLASS)], [h.code([], [SESSION])]),
    ]
  );

const featureView = (feature: Feature, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(
    feature.title,
    [h.Class("grid gap-1")],
    [
      h.h3([h.Class("text-lg leading-snug")], [feature.title]),
      h.p([h.Class("text-pretty text-neutral-600")], [feature.description]),
    ]
  );

const featuresView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-6")],
    [
      h.h2([h.Class(SECTION_HEADING_CLASS)], ["What you get"]),
      h.ul(
        [h.Class("grid gap-8 sm:grid-cols-2")],
        Array.map(FEATURES, (feature) => featureView(feature, h))
      ),
    ]
  );

const roadmapView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-6")],
    [
      h.h2([h.Class(SECTION_HEADING_CLASS)], ["What comes next"]),
      h.ul(
        [h.Class("grid gap-2 text-neutral-600")],
        Array.map(ROADMAP, (item) => h.keyed("li")(item, [], [item]))
      ),
    ]
  );

type Share = Readonly<{ label: string; projects: number }>;

const FEATURE_LABELS: Readonly<Record<string, string>> = {
  "github-actions": "Added the deploy workflow",
};

const PLATFORM_NAMES: Readonly<Record<string, string>> = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

// NOTE: The API counts whatever name it is sent, so only the names listed above are printed. A
// stranger's event can then add to a number, but never put words on the page.
const known = (
  tally: Stats["features"],
  labels: Readonly<Record<string, string>>,
  label: (name: string) => string
): ReadonlyArray<Share> =>
  pipe(
    Record.toEntries(labels),
    Array.map(([value, name]) => ({
      label: label(name),
      projects: tally[value] ?? 0,
    })),
    Array.filter((share) => share.projects > 0)
  );

const sharesOf = (stats: Stats): ReadonlyArray<Share> => {
  const platforms = known(
    stats.platforms,
    PLATFORM_NAMES,
    (name) => `Ran on ${name}`
  );

  // Every project has a platform, so the rest ran on one that is not listed.
  const elsewhere =
    stats.projects -
    Number.sumAll(Array.map(platforms, (share) => share.projects));

  return [
    { label: "Installed dependencies", projects: stats.installed },
    { label: "Initialized a git repository", projects: stats.withGit },
    ...known(stats.features, FEATURE_LABELS, (name) => name),
    { label: "Answered a question at the prompt", projects: stats.interactive },
    ...platforms,
    ...(elsewhere > 0
      ? [{ label: "Ran on another system", projects: elsewhere }]
      : []),
  ];
};

const PERCENT = 100;

const shareView = (
  share: Share,
  total: number,
  h: HtmlBuilder<Message>
): Html => {
  const percent = `${Number.round((share.projects / total) * PERCENT, 0)}%`;

  return h.keyed("li")(
    share.label,
    [h.Class("grid gap-2")],
    [
      h.div(
        [h.Class("flex justify-between gap-4")],
        [
          h.span([], [share.label]),
          h.span([h.Class("font-mono text-sm text-neutral-500")], [percent]),
        ]
      ),
      h.div(
        [h.Class("h-1 rounded-full bg-neutral-100"), h.AriaHidden(true)],
        [
          h.div([
            h.Class("h-1 rounded-full bg-neutral-900"),
            h.Style({ width: percent }),
          ]),
        ]
      ),
    ]
  );
};

const usageView = (stats: Stats, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-6")],
    [
      h.h2([h.Class(SECTION_HEADING_CLASS)], ["How it is used"]),
      h.p(
        [h.Class("max-w-xl text-pretty text-neutral-600")],
        [
          `How the ${formatProjects(stats.projects)} so far ${stats.projects === 1 ? "was" : "were"} created. Each run reports the options that were chosen and nothing else: no name, no path. `,
          h.code([h.Class(INLINE_CODE_CLASS)], ["DO_NOT_TRACK=1"]),
          " turns that off.",
        ]
      ),
      h.ul(
        [h.Class("grid gap-x-8 gap-y-5 text-neutral-600 sm:grid-cols-2")],
        Array.map(sharesOf(stats), (share) =>
          shareView(share, stats.projects, h)
        )
      ),
    ]
  );

const homeView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("grid gap-20")],
    [
      heroView(model, h),
      sessionView(h),
      featuresView(h),
      ...pipe(
        AsyncData.getData(model.usage),
        Option.filter((stats) => stats.projects > 0),
        Option.match({
          onNone: () => [],
          onSome: (stats) => [usageView(stats, h)],
        })
      ),
      roadmapView(h),
    ]
  );

const notFoundView = (h: HtmlBuilder<Message>, path: string): Html =>
  h.section(
    [h.Class("grid gap-4")],
    [
      h.h1([h.Class("text-4xl")], ["Page not found"]),
      h.p([h.Class("text-neutral-600")], [`Nothing lives at ${path}.`]),
      h.a(
        [h.Href(homeRouter()), h.Class(`justify-self-start ${LINK_CLASS}`)],
        ["Go home"]
      ),
    ]
  );

const footerView = (h: HtmlBuilder<Message>): Html =>
  h.footer(
    [h.Class("text-sm text-neutral-500")],
    [
      "Built by ",
      h.a([h.Href(SIEBIX_URL), h.Class(LINK_CLASS)], ["Siebix"]),
      ".",
    ]
  );

const layout = (h: HtmlBuilder<Message>, page: Html): Html =>
  h.main(
    [
      h.Class(
        "mx-auto grid min-h-screen max-w-3xl content-start gap-20 px-8 py-16 sm:py-24"
      ),
    ],
    [page, footerView(h)]
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  AppRoute.match(model.route, {
    Home: () => ({
      title: `${SITE_NAME}: ${TAGLINE}`,
      lang: "en",
      canonical: `${SITE_URL}${homeRouter()}`,
      body: layout(h, homeView(model, h)),
    }),
    Changelog: () => ({
      title: `Changelog | ${SITE_NAME}`,
      lang: "en",
      canonical: `${SITE_URL}${changelogRouter()}`,
      body: layout(h, Changelog.view(h)),
    }),
    NotFound: ({ path }) => ({
      title: `Page not found | ${SITE_NAME}`,
      lang: "en",
      body: layout(h, notFoundView(h, path)),
    }),
  });
