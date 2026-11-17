import { Array, Effect, Schema } from "effect";
import { Command } from "foldkit";
import type { Runtime, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";

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

export const Model = Schema.Struct({
  route: AppRoute,
});

export type Model = typeof Model.Type;

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
});

export type Message = typeof Message.Type;

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: { route: urlToAppRoute(url) },
});

// COMMAND

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

// UPDATE

type UpdateReturn = Update.Return<Model, Message>;

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
  });

// VIEW

const SESSION = [
  "? Project name (my-app) › shop",
  "? Add a database? › D1",
  "? Install dependencies with bun? › yes",
  "? Initialize a git repository? › yes",
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
    title: "A database if you want one",
    description:
      "D1 or Neon Postgres, with a migration, a repository written in Effect SQL and tests that cover it. Or none at all.",
  },
  {
    title: "The whole stack on your machine",
    description:
      "bun run dev and bun run test start the API, the website and a D1 database locally. Neither needs a Cloudflare account.",
  },
  {
    title: "Deployed with Alchemy",
    description:
      "One stack file deploys both to Cloudflare, and every stage is its own copy.",
  },
  {
    title: "Tooling that is already set up",
    description:
      "Ultracite, oxlint with Effect rules, oxfmt and effect-tsgo, passing from the first commit.",
  },
];

const ROADMAP: ReadonlyArray<string> = [
  "Sign-in with better-auth",
  "CI/CD with a preview for every pull request",
];

const heroView = (h: HtmlBuilder<Message>): Html =>
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

const homeView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("grid gap-20")],
    [heroView(h), sessionView(h), featuresView(h), roadmapView(h)]
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
      body: layout(h, homeView(h)),
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
