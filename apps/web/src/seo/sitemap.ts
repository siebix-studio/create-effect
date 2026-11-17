import { Array, pipe } from "effect";

import { prerenderPaths } from "../route.ts";
import { SITE_URL } from "../site.ts";
import { escapeMarkup } from "./markup.ts";

const urlEntry = (path: string): string =>
  `<url><loc>${escapeMarkup(`${SITE_URL}${path}`)}</loc></url>`;

/** Every prerendered page, so a page added to the build is listed without touching this file. */
export const sitemapXml = pipe(
  Array.map(prerenderPaths, urlEntry),
  Array.join(""),
  (entries) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`
);
