export const SiebixDomain = "siebix.com";

const SiteName = "effect";

/**
 * Where a stage is served. `prod` owns `effect.siebix.com`; every other stage (`pr-12`) gets
 * `effect-<stage>.siebix.com`. Stages stay one level below siebix.com because Cloudflare's free
 * certificate only covers `*.siebix.com`, not `*.effect.siebix.com`.
 *
 * The zone is looked up from the hostname. This stack never declares or adopts it, so destroying
 * a stage can't touch siebix.com itself.
 */
export const stageDomain = (stage: string): string => {
  if (stage === "prod") {
    return `${SiteName}.${SiebixDomain}`;
  }

  // Stage names may contain `_`; DNS labels can't.
  return `${SiteName}-${stage.replaceAll("_", "-")}.${SiebixDomain}`;
};
