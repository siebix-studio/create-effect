import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Neon from "@alchemy.run/neon";
import { Effect } from "effect";

// Every stage gets a Neon project of its own, `bun run dev` and the tests included: Neon has no
// local stand-in. The `.sql` files in `migrations/` at the root are applied in order on each
// deploy. The path is relative to the root, where every command runs.
export const Database = Neon.Project("Database", {
  // A project cannot move to another region, so choose before it holds data you care about.
  region: "aws-us-east-1",
  migrations: "./migrations",
});

export const Hyperdrive = Effect.gen(function* () {
  const database = yield* Database;

  return yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    // Hyperdrive pools connections itself, so it gets the direct endpoint.
    origin: database.origin,
    // Local Workers connect without Hyperdrive, so they go through Neon's own pooler.
    dev: database.pooledOrigin,
  });
});
