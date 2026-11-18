import { User } from "@app/domain/account";
import { Api } from "@app/domain/api";
import { Greeting } from "@app/domain/greeting";
import { Effect, Option, Redacted, Schema, String } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { AsyncData, Command, Http } from "foldkit";
import type { Runtime, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { defineTaggedUnion } from "foldkit/schema";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";

import { AppRoute, homeRouter, urlToAppRoute } from "./route";
import { SITE_NAME } from "./site";

// MODEL

export const GreetingAsyncData = AsyncData.Schema(Greeting, Schema.String);

/** Who the API says is signed in. `Checking` until it has answered. */
export const Session = defineTaggedUnion({
  Checking: {},
  SignedOut: {},
  SignedIn: { user: User },
});

export const AccountMode = Schema.Literals(["SignIn", "SignUp"]);

export const AccountSubmission = defineTaggedUnion({
  Idle: {},
  Submitting: {},
  Failed: { error: Schema.String },
});

// DevTools shows the Model, and prints a `Redacted` value as a placeholder.
const Password = Schema.Redacted(Schema.String);

export const Model = Schema.Struct({
  route: AppRoute,
  nameInput: Schema.String,
  greeting: GreetingAsyncData.schema,
  session: Session,
  accountMode: AccountMode,
  accountNameInput: Schema.String,
  emailInput: Schema.String,
  passwordInput: Password,
  accountSubmission: AccountSubmission,
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
  SucceededFetchSession: { maybeUser: Schema.Option(User) },
  FailedFetchSession: {},
  ClickedAccountMode: { mode: AccountMode },
  UpdatedAccountNameInput: { value: Schema.String },
  UpdatedEmailInput: { value: Schema.String },
  UpdatedPasswordInput: { value: Password },
  SubmittedAccountForm: {},
  SucceededSignIn: { user: User },
  FailedSignIn: { error: Schema.String },
  SucceededSignUp: { user: User },
  FailedSignUp: { error: Schema.String },
  ClickedSignOut: {},
  CompletedSignOut: {},
});

export type Message = typeof Message.Type;

// COMMAND

// Unset where the API is at /api of the website's own origin.
const API_URL = import.meta.env.VITE_API_URL;

/**
 * The session is a cookie the API set. On workers.dev and under `bun run dev` the API is another
 * origin, and the browser only sends a cookie there when asked to.
 */
const withSessionCookie = Effect.provideService(FetchHttpClient.RequestInit, {
  credentials: "include",
});

const UNREACHABLE = "The API could not be reached.";

const Account = Schema.Struct({ user: User });

const AuthError = Schema.Struct({ message: Schema.String });

/** Calls one of better-auth's own routes, which are not part of the typed contract. */
const postToAuth = (path: string, body: Record<string, string>) =>
  HttpClient.execute(
    HttpClientRequest.post(`${API_URL ?? ""}/api/auth${path}`).pipe(
      HttpClientRequest.bodyJsonUnsafe(body)
    )
  ).pipe(
    Effect.mapError(() => UNREACHABLE),
    Effect.flatMap(
      HttpClientResponse.matchStatus({
        "2xx": (response) => Effect.succeed(response),
        // better-auth says what was wrong: a taken address, a wrong password.
        orElse: (response) =>
          HttpClientResponse.schemaBodyJson(AuthError)(response).pipe(
            Effect.match({
              onFailure: () => UNREACHABLE,
              onSuccess: (error) => error.message,
            }),
            Effect.flatMap((message) => Effect.fail(message))
          ),
      })
    ),
    withSessionCookie,
    Effect.provide(Http.layer)
  );

const signedInUser = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(Account)(response).pipe(
    Effect.map((account) => account.user),
    Effect.mapError(() => UNREACHABLE)
  );

export const FetchSession = Command.define("FetchSession", {
  messages: [Message.SucceededFetchSession, Message.FailedFetchSession],
  execute: Effect.gen(function* () {
    const client = yield* HttpApiClient.make(Api, { baseUrl: API_URL });
    const user = yield* client.account.me();

    return Message.SucceededFetchSession({ maybeUser: Option.some(user) });
  }).pipe(
    Effect.catchTag("Unauthorized", () =>
      Effect.succeed(
        Message.SucceededFetchSession({ maybeUser: Option.none() })
      )
    ),
    Effect.orElseSucceed(() => Message.FailedFetchSession()),
    withSessionCookie,
    Effect.provide(Http.layer)
  ),
});

export const SignIn = Command.define("SignIn", {
  args: { email: Schema.String, password: Password },
  messages: [Message.SucceededSignIn, Message.FailedSignIn],
  execute: ({ email, password }) =>
    postToAuth("/sign-in/email", {
      email,
      password: Redacted.value(password),
    }).pipe(
      Effect.flatMap(signedInUser),
      Effect.match({
        onFailure: (error) => Message.FailedSignIn({ error }),
        onSuccess: (user) => Message.SucceededSignIn({ user }),
      })
    ),
});

export const SignUp = Command.define("SignUp", {
  args: { name: Schema.String, email: Schema.String, password: Password },
  messages: [Message.SucceededSignUp, Message.FailedSignUp],
  execute: ({ name, email, password }) =>
    postToAuth("/sign-up/email", {
      name,
      email,
      password: Redacted.value(password),
    }).pipe(
      Effect.flatMap(signedInUser),
      Effect.match({
        onFailure: (error) => Message.FailedSignUp({ error }),
        onSuccess: (user) => Message.SucceededSignUp({ user }),
      })
    ),
});

// Whether or not the API was reached, this browser is done with the session.
export const SignOut = Command.define("SignOut", {
  messages: [Message.CompletedSignOut],
  execute: postToAuth("/sign-out", {}).pipe(
    Effect.ignore,
    Effect.as(Message.CompletedSignOut())
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

export const FetchGreeting = Command.define("FetchGreeting", {
  args: { name: Schema.String },
  messages: [Message.SucceededFetchGreeting, Message.FailedFetchGreeting],
  execute: ({ name }) =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api, { baseUrl: API_URL });

      const greeting = yield* client.greetings.greet({ params: { name } });

      return Message.SucceededFetchGreeting({ greeting });
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.FailedFetchGreeting({ error: "The API could not be reached." })
      ),
      Effect.provide(Http.layer)
    ),
});

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: {
    route: urlToAppRoute(url),
    nameInput: "",
    greeting: GreetingAsyncData.Idle(),
    session: Session.Checking(),
    accountMode: "SignIn",
    accountNameInput: "",
    emailInput: "",
    passwordInput: Redacted.make(""),
    accountSubmission: AccountSubmission.Idle(),
  },
  commands: [FetchSession()],
});

// UPDATE

type UpdateReturn = Update.Return<Model, Message>;

const signedIn = (model: Model, user: User): UpdateReturn => ({
  model: modifyFields(model, {
    session: () => Session.SignedIn({ user }),
    passwordInput: () => Redacted.make(""),
    accountSubmission: () => AccountSubmission.Idle(),
  }),
});

const failedToSignIn = (model: Model, error: string): UpdateReturn => ({
  model: modifyFields(model, {
    accountSubmission: () => AccountSubmission.Failed({ error }),
  }),
});

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
    SucceededFetchSession: ({ maybeUser }) => ({
      model: modifyFields(model, {
        session: () =>
          Option.match(maybeUser, {
            onNone: () => Session.SignedOut(),
            onSome: (user) => Session.SignedIn({ user }),
          }),
      }),
    }),
    // Without an answer nobody is signed in here. Signing in says what is wrong.
    FailedFetchSession: () => ({
      model: modifyFields(model, { session: () => Session.SignedOut() }),
    }),
    ClickedAccountMode: ({ mode }) => ({
      model: modifyFields(model, {
        accountMode: () => mode,
        accountSubmission: () => AccountSubmission.Idle(),
      }),
    }),
    UpdatedAccountNameInput: ({ value }) => ({
      model: modifyFields(model, { accountNameInput: () => value }),
    }),
    UpdatedEmailInput: ({ value }) => ({
      model: modifyFields(model, { emailInput: () => value }),
    }),
    UpdatedPasswordInput: ({ value }) => ({
      model: modifyFields(model, { passwordInput: () => value }),
    }),
    SubmittedAccountForm: () => {
      if (model.accountSubmission._tag === "Submitting") {
        return { model };
      }

      const email = String.trim(model.emailInput);
      const password = model.passwordInput;

      return {
        model: modifyFields(model, {
          accountSubmission: () => AccountSubmission.Submitting(),
        }),
        commands: [
          model.accountMode === "SignIn"
            ? SignIn({ email, password })
            : SignUp({
                name: String.trim(model.accountNameInput),
                email,
                password,
              }),
        ],
      };
    },
    SucceededSignIn: ({ user }) => signedIn(model, user),
    FailedSignIn: ({ error }) => failedToSignIn(model, error),
    SucceededSignUp: ({ user }) => signedIn(model, user),
    FailedSignUp: ({ error }) => failedToSignIn(model, error),
    ClickedSignOut: () => ({ model, commands: [SignOut()] }),
    CompletedSignOut: () => ({
      model: modifyFields(model, { session: () => Session.SignedOut() }),
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

const INPUT_CLASS = "w-full rounded-lg border border-neutral-300 px-4 py-2";

const BUTTON_CLASS =
  "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50";

const accountFormView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const isSigningUp = model.accountMode === "SignUp";
  const isSubmitting = model.accountSubmission._tag === "Submitting";

  return h.form(
    [
      h.AriaLabel("Account"),
      h.Class("grid gap-3"),
      h.OnSubmit(Message.SubmittedAccountForm()),
    ],
    [
      // Keyed, so the browser keeps each field's own state when the name field comes and goes.
      isSigningUp
        ? h.input([
            h.Key("account-name"),
            h.Type("text"),
            h.Value(model.accountNameInput),
            h.OnInput((value) => Message.UpdatedAccountNameInput({ value })),
            h.AriaLabel("Name"),
            h.Placeholder("Name"),
            h.Autocomplete("name"),
            h.Required(true),
            h.Class(INPUT_CLASS),
          ])
        : h.empty,
      h.input([
        h.Key("account-email"),
        h.Type("email"),
        h.Value(model.emailInput),
        h.OnInput((value) => Message.UpdatedEmailInput({ value })),
        h.AriaLabel("Email"),
        h.Placeholder("Email"),
        h.Autocomplete("email"),
        h.Required(true),
        h.Class(INPUT_CLASS),
      ]),
      h.input([
        h.Key("account-password"),
        h.Type("password"),
        h.Value(Redacted.value(model.passwordInput)),
        h.OnInput((value) =>
          Message.UpdatedPasswordInput({ value: Redacted.make(value) })
        ),
        h.AriaLabel("Password"),
        h.Placeholder("Password"),
        h.Autocomplete(isSigningUp ? "new-password" : "current-password"),
        h.Required(true),
        h.Class(INPUT_CLASS),
      ]),
      AccountSubmission.match(model.accountSubmission, {
        Idle: () => h.empty,
        Submitting: () => h.empty,
        Failed: ({ error }) =>
          h.p([h.Role("alert"), h.Class("text-red-700")], [error]),
      }),
      h.div(
        [h.Class("flex items-center gap-4")],
        [
          h.button(
            [h.Type("submit"), h.Disabled(isSubmitting), h.Class(BUTTON_CLASS)],
            [isSigningUp ? "Create account" : "Sign in"]
          ),
          h.button(
            [
              h.Type("button"),
              h.OnClick(
                Message.ClickedAccountMode({
                  mode: isSigningUp ? "SignIn" : "SignUp",
                })
              ),
              h.Class("underline"),
            ],
            [isSigningUp ? "I have an account" : "Create an account"]
          ),
        ]
      ),
    ]
  );
};

const accountView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("grid gap-4")],
    [
      h.h2([h.Class("text-2xl font-semibold")], ["Account"]),
      Session.match(model.session, {
        Checking: () =>
          h.p([h.Class("text-neutral-600")], ["Checking who is signed in..."]),
        SignedOut: () => accountFormView(model, h),
        SignedIn: ({ user }) =>
          h.div(
            [h.Class("grid gap-3")],
            [
              h.p([], [`Signed in as ${user.name} (${user.email}).`]),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(Message.ClickedSignOut()),
                  h.Class(BUTTON_CLASS),
                ],
                ["Sign out"]
              ),
            ]
          ),
      }),
    ]
  );

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
        [
          h.AriaLabel("Greeting"),
          h.Class("flex gap-3"),
          h.OnSubmit(Message.SubmittedGreetingForm()),
        ],
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
      accountView(model, h),
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
