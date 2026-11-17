import type { ServerResponse } from "node:http";

import { Array, Effect, Option } from "effect";
import type { Plugin } from "vite";

import { SITE_OG_IMAGE_PATH } from "../src/seo/og-image.ts";
import { ROBOTS_PATH, SITEMAP_PATH, robotsTxt } from "../src/seo/robots.ts";
import { sitemapXml } from "../src/seo/sitemap.ts";
import { INSTALL_COMMAND, TAGLINE } from "../src/site.ts";
import { renderOgCard } from "./og-card.ts";

type GeneratedFile = Readonly<{
  path: string;
  contentType: string;
  render: () => Promise<string | Uint8Array>;
}>;

const GENERATED_FILES: ReadonlyArray<GeneratedFile> = [
  {
    path: ROBOTS_PATH,
    contentType: "text/plain; charset=utf-8",
    render: async () => await Promise.resolve(robotsTxt),
  },
  {
    path: SITEMAP_PATH,
    contentType: "application/xml; charset=utf-8",
    render: async () => await Promise.resolve(sitemapXml),
  },
  {
    path: SITE_OG_IMAGE_PATH,
    contentType: "image/png",
    render: async () =>
      await renderOgCard({ title: TAGLINE, footer: INSTALL_COMMAND }),
  },
];

const serveGeneratedFile = async (
  pathname: string,
  response: ServerResponse
): Promise<boolean> => {
  const maybeFile = Array.findFirst(
    GENERATED_FILES,
    (file) => file.path === pathname
  );

  if (Option.isNone(maybeFile)) {
    return false;
  }

  response.setHeader("content-type", maybeFile.value.contentType);
  response.end(await maybeFile.value.render());

  return true;
};

/**
 * robots.txt, the sitemap and the Open Graph image. They are written into the client build, and
 * served on request by the dev server.
 */
export const seoFiles = (): Plugin => ({
  name: "create-effect-seo-files",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const { pathname } = new URL(request.url ?? "/", "http://localhost");

      Effect.runFork(
        Effect.tryPromise(
          async () => await serveGeneratedFile(pathname, response)
        ).pipe(
          Effect.matchEffect({
            onFailure: ({ cause }) =>
              Effect.sync(() => {
                next(cause);
              }),
            onSuccess: (isServed) =>
              Effect.when(
                Effect.sync(() => {
                  next();
                }),
                Effect.succeed(!isServed)
              ),
          })
        )
      );
    });
  },
  async generateBundle() {
    if (this.environment.name !== "client") {
      return;
    }

    await Promise.all(
      Array.map(GENERATED_FILES, async (file) => {
        this.emitFile({
          type: "asset",
          fileName: file.path.slice(1),
          source: await file.render(),
        });
      })
    );
  },
});
