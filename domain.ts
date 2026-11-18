export const SiebixDomain = "siebix.com";

const SiteName = "effect";

/** `alchemy dev` (`dev_<user>`) and the integration test (`test_<user>`). */
export const isLocal = (stage: string): boolean =>
  stage.startsWith("dev_") || stage.startsWith("test_");

// Stage names may contain `_`; DNS labels can't.
const stageHost = (name: string, stage: string): string =>
  stage === "prod"
    ? `${name}.${SiebixDomain}`
    : `${name}-${stage.replaceAll("_", "-")}.${SiebixDomain}`;

/**
 * Where a stage is served. `prod` owns `effect.siebix.com`; every other stage (`pr-12`) gets
 * `effect-<stage>.siebix.com`. Stages stay one level below siebix.com because Cloudflare's free
 * certificate only covers `*.siebix.com`, not `*.effect.siebix.com`.
 *
 * The zone is looked up from the hostname. This stack never declares or adopts it, so destroying
 * a stage can't touch siebix.com itself.
 */
export const stageDomain = (stage: string): string =>
  stageHost(SiteName, stage);

/** `effect-api.siebix.com` for `prod`, `effect-api-<stage>.siebix.com` for the others. */
export const apiDomain = (stage: string): string =>
  stageHost(`${SiteName}-api`, stage);
