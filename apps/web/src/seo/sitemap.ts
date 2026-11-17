import { Array, pipe } from "effect";

import { prerenderPaths } from "../route.ts";
import { SITE_URL } from "../site.ts";
import { escapeMarkup } from "./markup.ts";

const urlEntry = (path: string): string =>
  `<url><loc>${escapeMarkup(`${SITE_URL}${path}`)}</loc></url>`;

const urlSet = (entries: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`;

export const sitemapXml = pipe(
  prerenderPaths,
  Array.map(urlEntry),
  Array.join(""),
  urlSet
);
