/**
 * The hostname the `prod` stage is served from, on a zone of the Cloudflare account that deploys
 * it. Empty: `prod` is served from workers.dev, as every other stage is.
 */
const DOMAIN = "{{domain}}";

/** Where a stage is served, or `undefined` for workers.dev (and localhost under `alchemy dev`). */
export const stageHostname = (stage: string): string | undefined =>
  stage === "prod" && DOMAIN.length > 0 ? DOMAIN : undefined;

/**
 * Puts the API at `/api` of a stage's hostname, where it has one. A route wins over the website's
 * custom domain, so the two share one origin. On workers.dev each keeps an address of its own.
 */
export const apiRoutes = (stage: string): { pattern: string }[] => {
  const hostname = stageHostname(stage);

  return hostname === undefined ? [] : [{ pattern: `${hostname}/api/*` }];
};
