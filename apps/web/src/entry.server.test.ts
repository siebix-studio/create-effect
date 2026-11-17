import { describe, expect, test } from "vitest";

import { renderDocument } from "./entry.server";
import { sitemapXml } from "./seo/sitemap";
import { SITE_DESCRIPTION } from "./site";

const ASSETS = {
  entryScript: "/entry.js",
  stylesheets: [],
  modulePreloads: [],
};

describe("renderDocument", () => {
  test("describes the page to search engines and link previews", () => {
    const html = renderDocument({ html: "", title: "create-effect" }, ASSETS);

    expect(html).toContain(
      `<meta name="description" content="${SITE_DESCRIPTION}">`
    );
    expect(html).toContain(
      '<meta property="og:title" content="create-effect">'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://effect.siebix.com/og/site.png">'
    );
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image">'
    );
    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    );
  });
});

describe("sitemapXml", () => {
  test("lists the prerendered pages at the production URL", () => {
    expect(sitemapXml).toContain("<loc>https://effect.siebix.com/</loc>");
  });
});
