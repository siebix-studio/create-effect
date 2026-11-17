import { Array, pipe } from "effect";

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../site.ts";
import { escapeMarkup } from "./markup.ts";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_OG_IMAGE_PATH,
} from "./og-image.ts";

const metaTag = (
  attribute: "name" | "property",
  key: string,
  content: string
): string => `<meta ${attribute}="${key}" content="${escapeMarkup(content)}">`;

export const SITE_HEAD = pipe(
  [
    metaTag("name", "color-scheme", "light"),
    metaTag("name", "theme-color", "#ffffff"),
    metaTag("property", "og:site_name", SITE_NAME),
    metaTag("property", "og:locale", "en_GB"),
    metaTag("property", "og:type", "website"),
    metaTag("name", "twitter:card", "summary_large_image"),
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  ],
  Array.join("")
);

/**
 * The tags that describe one page. The image URL always points at production: link previews are
 * fetched by other sites, which cannot reach a preview stage behind Cloudflare Access.
 */
export const pageHead = (title: string): string =>
  pipe(
    [
      metaTag("name", "description", SITE_DESCRIPTION),
      metaTag("property", "og:title", title),
      metaTag("property", "og:description", SITE_DESCRIPTION),
      metaTag("property", "og:image", `${SITE_URL}${SITE_OG_IMAGE_PATH}`),
      metaTag("property", "og:image:width", String(OG_IMAGE_WIDTH)),
      metaTag("property", "og:image:height", String(OG_IMAGE_HEIGHT)),
      metaTag("property", "og:image:alt", title),
    ],
    Array.join("")
  );
