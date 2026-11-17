import { Array, Cause, Effect, Option, String } from "effect";
import type { Plugin } from "vite";

import { SITE_OG_IMAGE_PATH } from "../src/seo/og-image.ts";
import { ROBOTS_PATH, SITEMAP_PATH, robotsTxt } from "../src/seo/robots.ts";
import { sitemapXml } from "../src/seo/sitemap.ts";
import { INSTALL_COMMAND, TAGLINE } from "../src/site.ts";
import { renderOgCard } from "./og-card.ts";

type GeneratedFile = Readonly<{
  path: string;
  contentType: string;
  render: Effect.Effect<string | Uint8Array>;
}>;

const GENERATED_FILES: ReadonlyArray<GeneratedFile> = [
  {
    path: ROBOTS_PATH,
    contentType: "text/plain; charset=utf-8",
    render: Effect.succeed(robotsTxt),
  },
  {
    path: SITEMAP_PATH,
    contentType: "application/xml; charset=utf-8",
    render: Effect.succeed(sitemapXml),
  },
  {
    path: SITE_OG_IMAGE_PATH,
    contentType: "image/png",
    render: renderOgCard({ title: TAGLINE, footer: INSTALL_COMMAND }),
  },
];

const LEADING_SLASH_LENGTH = 1;

const toAssetFileName = String.slice(LEADING_SLASH_LENGTH);

const maybeGeneratedFile = (pathname: string): Option.Option<GeneratedFile> =>
  Array.findFirst(GENERATED_FILES, ({ path }) => path === pathname);

export const seoFiles = (): Plugin => ({
  name: "create-effect-seo-files",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const { pathname } = new URL(request.url ?? "/", "http://localhost");

      Option.match(maybeGeneratedFile(pathname), {
        onNone: () => {
          next();
        },
        onSome: ({ contentType, render }) => {
          Effect.runFork(
            Effect.matchCause(render, {
              onFailure: (cause) => {
                next(Cause.squash(cause));
              },
              onSuccess: (body) => {
                response.setHeader("content-type", contentType);
                response.end(body);
              },
            })
          );
        },
      });
    });
  },
  async generateBundle() {
    if (this.environment.name !== "client") {
      return;
    }

    await Effect.runPromise(
      Effect.forEach(
        GENERATED_FILES,
        ({ path, render }) =>
          Effect.map(render, (source) =>
            this.emitFile({
              type: "asset",
              fileName: toAssetFileName(path),
              source,
            })
          ),
        { concurrency: "unbounded", discard: true }
      )
    );
  },
});
