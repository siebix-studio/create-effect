import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Neon from "@alchemy.run/neon";
import { Effect } from "effect";

export const Database = Neon.Project("Database", {
  // Cannot be changed once the project exists.
  region: "aws-us-east-1",
  // The most Neon's Free plan allows. Alchemy asks for a day otherwise.
  historyRetentionSeconds: 21_600,
  migrations: "./migrations",
});

export const Hyperdrive = Effect.gen(function* () {
  const database = yield* Database;

  return yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    origin: database.origin,
    // Local Workers connect without Hyperdrive, so they use Neon's own pooler.
    dev: database.pooledOrigin,
  });
});
