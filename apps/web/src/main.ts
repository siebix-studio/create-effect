import { Array, Effect, Schema } from "effect";
import { Command } from "foldkit";
import type { Runtime, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";

import { AppRoute, homeRouter, urlToAppRoute } from "./route";
import { PACKAGE_NAME, SIEBIX_URL, SITE_NAME, SITE_URL } from "./site";

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

export const INSTALL_COMMAND = `bunx ${PACKAGE_NAME} my-app`;

const FEATURES: ReadonlyArray<{
  readonly title: string;
  readonly description: string;
}> = [
  {
    title: "Foldkit frontend",
    description: "A prerendered Foldkit app, served from a Cloudflare Worker.",
  },
  {
    title: "Effect backend on Cloudflare",
    description: "An Effect HTTP API on Workers, deployed in the same stack.",
  },
  {
    title: "D1 or Neon Postgres",
    description: "Pick the database when you create the project.",
  },
  {
    title: "better-auth",
    description:
      "Sign-in backed by your database, with its schema applied on deploy.",
  },
  {
    title: "Cloudflare Access",
    description: "Preview deployments are visible to your team only.",
  },
  {
    title: "Tooling",
    description:
      "Ultracite, oxlint with Effect rules, oxfmt, effect-tsgo and lefthook.",
  },
  {
    title: "CI/CD",
    description:
      "GitHub Actions checks every change, deploys main and gives each pull request its own preview.",
  },
];

const featureView = (
  h: HtmlBuilder<Message>,
  feature: (typeof FEATURES)[number]
): Html =>
  h.li(
    [h.Class("grid gap-1")],
    [
      h.span([h.Class("font-semibold")], [feature.title]),
      h.span([h.Class("text-neutral-600")], [feature.description]),
    ]
  );

const homeView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-12")],
    [
      h.header(
        [h.Class("grid gap-4")],
        [
          h.span(
            [
              h.Class(
                "w-fit rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-600"
              ),
            ],
            ["In development"]
          ),
          h.h1([h.Class("text-4xl font-bold tracking-tight")], [SITE_NAME]),
          h.p(
            [h.Class("text-lg text-neutral-700")],
            [
              "Scaffold full-stack Effect apps on Cloudflare, deployed with Alchemy.",
            ]
          ),
          h.pre(
            [
              h.Class(
                "overflow-x-auto rounded-lg bg-neutral-900 px-4 py-3 text-sm text-neutral-100"
              ),
            ],
            [h.code([], [INSTALL_COMMAND])]
          ),
        ]
      ),
      h.section(
        [h.Class("grid gap-6")],
        [
          h.h2([h.Class("text-2xl font-semibold")], ["What you get"]),
          h.ul(
            [h.Class("grid gap-5")],
            Array.map(FEATURES, (feature) => featureView(h, feature))
          ),
        ]
      ),
    ]
  );

const notFoundView = (h: HtmlBuilder<Message>, path: string): Html =>
  h.section(
    [h.Class("grid gap-4")],
    [
      h.h1([h.Class("text-4xl font-bold tracking-tight")], ["Page not found"]),
      h.p([], [`Nothing lives at ${path}.`]),
      h.a([h.Href(homeRouter()), h.Class("w-fit underline")], ["Go home"]),
    ]
  );

const footerView = (h: HtmlBuilder<Message>): Html =>
  h.footer(
    [h.Class("text-sm text-neutral-600")],
    [
      "Built by ",
      h.a([h.Href(SIEBIX_URL), h.Class("underline")], ["Siebix"]),
      ".",
    ]
  );

const layout = (h: HtmlBuilder<Message>, page: Html): Html =>
  h.main(
    [h.Class("mx-auto grid min-h-screen max-w-3xl content-start gap-16 p-8")],
    [page, footerView(h)]
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  AppRoute.match(model.route, {
    Home: () => ({
      title: `${SITE_NAME}: scaffold Effect apps on Cloudflare`,
      lang: "en",
      canonical: `${SITE_URL}${homeRouter()}`,
      body: layout(h, homeView(h)),
    }),
    NotFound: ({ path }) => ({
      title: `Page not found | ${SITE_NAME}`,
      lang: "en",
      body: layout(h, notFoundView(h, path)),
    }),
  });
