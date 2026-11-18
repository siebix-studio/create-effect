## Sign-in

People sign up and sign in with an email address and a password. [better-auth](https://better-auth.com) runs inside the API Worker, through [Alchemy's integration](https://alchemy.run/better-auth), and keeps its users and sessions in the project's D1 database, next to the greetings.

- `apps/api/src/auth.ts` configures better-auth and holds the middleware that turns a session into the current user. better-auth serves its own routes under `/api/auth`; the Worker hands those to it and everything else to the API.
- `packages/domain/src/account.ts` holds the `Authentication` middleware and `CurrentUser`. A group of the contract that calls `.middleware(Authentication)` only answers someone who is signed in, and its handlers read `CurrentUser`. `GET /api/me` is the example.
- The website's account section signs up, signs in and signs out by calling better-auth's routes, and asks `GET /api/me` who is signed in when the page loads.

better-auth's tables (`user`, `session`, `account`, `verification`) are not in `migrations/`: Alchemy creates and extends them whenever the stack starts or deploys. The key that signs sessions is generated on the first deploy and kept in the stack's state, so sessions survive a deploy.

The session is an HttpOnly cookie. On workers.dev and under `bun run dev` the website and the API are two origins of one site, so the browser sends the cookie along, and the API lets its own website call with it: the same host, or another Worker of the same account (`isOwnWebsite` in `apps/api/src/auth.ts`). Every other origin is refused. With a domain in `domain.ts`, `prod` is one origin and none of this comes into play. If you serve the website from anywhere else, add that origin there.

Nothing verifies an email address, and there is no password reset: both need a way to send email. better-auth's [email and password guide](https://better-auth.com/docs/authentication/email-password) shows where they plug in.

In a deployed stage, a request to a protected endpoint has a span named `authenticate` in its trace, with the user's id on it, and the queries better-auth runs show up as D1 spans.
