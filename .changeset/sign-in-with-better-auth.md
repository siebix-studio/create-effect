---
"@siebix/create-effect": minor
---

New question, and its `--better-auth` flag: with the D1 database, the project can get sign-in with [better-auth](https://better-auth.com). It runs inside the API Worker through Alchemy's integration and keeps its users and sessions in the project's D1 database. People sign up and sign in with an email address and a password; the session is an HttpOnly cookie. The contract gets an `Authentication` middleware with `GET /api/me` behind it, and the website an account section that signs up, signs in and signs out. `create-effect add better-auth` adds it to a project that has D1. It is not written for Neon yet, and both the flag and `add` say so.
