import { Option, Redacted } from "effect";
import {
  Command,
  click,
  expect,
  given,
  label,
  role,
  scene,
  submit,
  text,
  type,
} from "foldkit/scene";
import { fromString } from "foldkit/url";
import { expect as assert, describe, test } from "vitest";

import {
  AccountSubmission,
  FetchGreeting,
  FetchSession,
  GreetingAsyncData,
  Message,
  Model,
  Session,
  SignIn,
  SignOut,
  SignUp,
  init,
  update,
  view,
} from "./main";
import { AppRoute } from "./route";

const ada = { id: "user-1", name: "Ada", email: "ada@example.com" };

const signedOut = Model.make({
  route: AppRoute.Home(),
  nameInput: "",
  greeting: GreetingAsyncData.Idle(),
  session: Session.SignedOut(),
  accountMode: "SignIn",
  accountNameInput: "",
  emailInput: "",
  passwordInput: Redacted.make(""),
  accountSubmission: AccountSubmission.Idle(),
});

const greetingForm = role("form", { name: "Greeting" });

const accountForm = role("form", { name: "Account" });

describe("init", () => {
  test("asks the API who is signed in", () => {
    const { commands } = init(
      Option.getOrThrow(fromString("https://example.com/"))
    );

    assert(commands).toStrictEqual([FetchSession()]);
  });
});

describe("view", () => {
  test("submitting a name shows the greeting from the API", () => {
    scene(
      { update, view },
      given(signedOut),
      type(label("Your name"), "Ada"),
      submit(greetingForm),
      Command.expectExact(FetchGreeting({ name: "Ada" })),
      expect(text("Asking the API...")).toExist(),
      Command.resolve(
        FetchGreeting,
        Message.SucceededFetchGreeting({ greeting: { message: "Hello, Ada!" } })
      ),
      expect(text("Hello, Ada!")).toExist()
    );
  });

  test("the page shows who the API says is signed in", () => {
    const checking = Model.make({ ...signedOut, session: Session.Checking() });

    scene(
      { update, view },
      given(checking),
      expect(text("Checking who is signed in...")).toExist()
    );

    scene(
      { update, view },
      given(
        update(
          checking,
          Message.SucceededFetchSession({ maybeUser: Option.some(ada) })
        ).model
      ),
      expect(text("Signed in as Ada (ada@example.com).")).toExist()
    );
  });

  test("signing in shows who is signed in, and signing out the form again", () => {
    scene(
      { update, view },
      given(signedOut),
      type(label("Email"), "ada@example.com"),
      type(label("Password"), "correct horse"),
      submit(accountForm),
      Command.expectExact(
        SignIn({
          email: "ada@example.com",
          password: Redacted.make("correct horse"),
        })
      ),
      Command.resolve(SignIn, Message.SucceededSignIn({ user: ada })),
      expect(text("Signed in as Ada (ada@example.com).")).toExist(),
      click(role("button", { name: "Sign out" })),
      Command.resolve(SignOut, Message.CompletedSignOut()),
      expect(label("Email")).toExist()
    );
  });

  test("a refused sign-in says why", () => {
    scene(
      { update, view },
      given(signedOut),
      type(label("Email"), "ada@example.com"),
      type(label("Password"), "wrong"),
      submit(accountForm),
      Command.resolve(
        SignIn,
        Message.FailedSignIn({ error: "Invalid email or password" })
      ),
      expect(role("alert")).toHaveText("Invalid email or password")
    );
  });

  test("creating an account asks for a name too", () => {
    scene(
      { update, view },
      given(signedOut),
      click(role("button", { name: "Create an account" })),
      type(label("Name"), "Ada"),
      type(label("Email"), "ada@example.com"),
      type(label("Password"), "correct horse"),
      submit(accountForm),
      Command.expectExact(
        SignUp({
          name: "Ada",
          email: "ada@example.com",
          password: Redacted.make("correct horse"),
        })
      ),
      Command.resolve(SignUp, Message.SucceededSignUp({ user: ada })),
      expect(text("Signed in as Ada (ada@example.com).")).toExist()
    );
  });

  test("an unknown path shows the not found page", () => {
    scene(
      { update, view },
      given(
        Model.make({
          ...signedOut,
          route: AppRoute.NotFound({ path: "/nope" }),
        })
      ),
      expect(role("heading", { name: "Page not found" })).toExist(),
      expect(text("Nothing lives at /nope.")).toExist()
    );
  });
});
