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

// NOTE: The image URL is the production one on every stage. Link previews are fetched by other
// sites, which cannot reach a preview stage behind Cloudflare Access.
const OG_IMAGE_URL = `${SITE_URL}${SITE_OG_IMAGE_PATH}`;

export const SITE_HEAD = pipe(
  [
    metaTag("name", "color-scheme", "light"),
    metaTag("name", "theme-color", "#ffffff"),
    metaTag("property", "og:site_name", SITE_NAME),
    metaTag("property", "og:locale", "en_US"),
    metaTag("property", "og:type", "website"),
    metaTag("property", "og:image", OG_IMAGE_URL),
    metaTag("property", "og:image:type", "image/png"),
    metaTag("property", "og:image:width", `${OG_IMAGE_WIDTH}`),
    metaTag("property", "og:image:height", `${OG_IMAGE_HEIGHT}`),
    metaTag("name", "twitter:card", "summary_large_image"),
    metaTag("name", "twitter:image", OG_IMAGE_URL),
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  ],
  Array.join("")
);

export const pageHead = (title: string): string =>
  pipe(
    [
      metaTag("name", "description", SITE_DESCRIPTION),
      metaTag("property", "og:title", title),
      metaTag("property", "og:description", SITE_DESCRIPTION),
      metaTag("property", "og:image:alt", title),
      metaTag("name", "twitter:title", title),
      metaTag("name", "twitter:description", SITE_DESCRIPTION),
      metaTag("name", "twitter:image:alt", title),
    ],
    Array.join("")
  );
