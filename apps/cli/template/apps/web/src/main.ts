import { Api } from "@app/domain/api";
import { Greeting } from "@app/domain/greeting";
import { Effect, Schema, String } from "effect";
import { HttpApiClient } from "effect/http-api";
import { AsyncData, Command, Http } from "foldkit";
import type { Runtime, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";

import { AppRoute, homeRouter, urlToAppRoute } from "./route";
import { SITE_NAME } from "./site";

// MODEL

export const GreetingAsyncData = AsyncData.Schema(Greeting, Schema.String);

export const Model = Schema.Struct({
  route: AppRoute,
  nameInput: Schema.String,
  greeting: GreetingAsyncData.schema,
});

export type Model = typeof Model.Type;

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  UpdatedNameInput: { value: Schema.String },
  SubmittedGreetingForm: {},
  SucceededFetchGreeting: { greeting: Greeting },
  FailedFetchGreeting: { error: Schema.String },
});

export type Message = typeof Message.Type;

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: {
    route: urlToAppRoute(url),
    nameInput: "",
    greeting: GreetingAsyncData.Idle(),
  },
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

export const FetchGreeting = Command.define("FetchGreeting", {
  args: { name: Schema.String },
  messages: [Message.SucceededFetchGreeting, Message.FailedFetchGreeting],
  execute: ({ name }) =>
    Effect.gen(function* () {
      // Unset where the API is at /api of the website's own origin.
      const client = yield* HttpApiClient.make(Api, {
        baseUrl: import.meta.env.VITE_API_URL,
      });

      const greeting = yield* client.greetings.greet({ params: { name } });

      return Message.SucceededFetchGreeting({ greeting });
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.FailedFetchGreeting({ error: "The API could not be reached." })
      ),
      Effect.provide(Http.layer)
    ),
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
    UpdatedNameInput: ({ value }) => ({
      model: modifyFields(model, { nameInput: () => value }),
    }),
    SubmittedGreetingForm: () => {
      const name = String.trim(model.nameInput);

      if (String.isEmpty(name) || AsyncData.isPending(model.greeting)) {
        return { model };
      }

      return {
        model: modifyFields(model, {
          greeting: () => GreetingAsyncData.Loading(),
        }),
        commands: [FetchGreeting({ name })],
      };
    },
    SucceededFetchGreeting: ({ greeting }) => ({
      model: modifyFields(model, {
        greeting: () => GreetingAsyncData.Success({ data: greeting }),
      }),
    }),
    FailedFetchGreeting: ({ error }) => ({
      model: modifyFields(model, {
        greeting: () => GreetingAsyncData.Failure({ error }),
      }),
    }),
  });

// VIEW

const greetingView = (model: Model, h: HtmlBuilder<Message>): Html =>
  AsyncData.matchDataSplitEmpty(model.greeting, {
    onIdle: () => h.empty,
    onLoading: () => h.p([h.Class("text-neutral-600")], ["Asking the API..."]),
    onFailure: (error) =>
      h.p([h.Role("alert"), h.Class("text-red-700")], [error]),
    onData: (greeting) =>
      h.p([h.Class("text-2xl font-semibold")], [greeting.message]),
  });

const homeView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-8")],
    [
      h.header(
        [h.Class("grid gap-4")],
        [
          h.h1([h.Class("text-4xl font-bold tracking-tight")], [SITE_NAME]),
          h.p(
            [h.Class("text-lg text-neutral-700")],
            [
              "A Foldkit frontend calling an Effect HTTP API on Cloudflare. Both sides share one typed contract.",
            ]
          ),
        ]
      ),
      h.form(
        [h.Class("flex gap-3"), h.OnSubmit(Message.SubmittedGreetingForm())],
        [
          h.input([
            h.Type("text"),
            h.Value(model.nameInput),
            h.OnInput((value) => Message.UpdatedNameInput({ value })),
            h.AriaLabel("Your name"),
            h.Placeholder("Your name"),
            h.Autocomplete("off"),
            h.Class("w-full rounded-lg border border-neutral-300 px-4 py-2"),
          ]),
          h.button(
            [
              h.Type("submit"),
              h.Disabled(AsyncData.isPending(model.greeting)),
              h.Class(
                "rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
              ),
            ],
            ["Greet"]
          ),
        ]
      ),
      greetingView(model, h),
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

const layout = (h: HtmlBuilder<Message>, page: Html): Html =>
  h.main(
    [h.Class("mx-auto grid min-h-screen max-w-3xl content-start gap-16 p-8")],
    [page]
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  AppRoute.match(model.route, {
    Home: () => ({
      title: SITE_NAME,
      lang: "en",
      body: layout(h, homeView(model, h)),
    }),
    NotFound: ({ path }) => ({
      title: `Page not found | ${SITE_NAME}`,
      lang: "en",
      body: layout(h, notFoundView(h, path)),
    }),
  });
