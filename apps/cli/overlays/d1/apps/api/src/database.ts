import * as Cloudflare from "@alchemy.run/cloudflare";

// The `.sql` files in `migrations/` at the root are applied in order whenever the stack is deployed
// or started, locally too. The path is relative to the root, where every command runs.
export const Database = Cloudflare.D1.Database("Database", {
  migrations: "./migrations",
});
