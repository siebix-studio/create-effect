import { SITE_URL } from "../site.ts";

export const ROBOTS_PATH = "/robots.txt";

export const SITEMAP_PATH = "/sitemap.xml";

export const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}${SITEMAP_PATH}
`;
