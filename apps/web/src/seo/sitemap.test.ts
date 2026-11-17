import { expect, test } from "vitest";

import { sitemapXml } from "./sitemap.ts";

test("lists the prerendered pages at the production URL", () => {
  expect(sitemapXml).toContain("<loc>https://effect.siebix.com/</loc>");
});
