import geistMonoLatin from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url";
import geistPixelLatin from "@fontsource-variable/geist-pixel/files/geist-pixel-latin-elsh-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { Array, Effect, Option } from "effect";
import { Server } from "foldkit/experimental";
import * as Url from "foldkit/url";

import { init, view } from "./main";
import { urlToAppRoute } from "./route";
import * as Seo from "./seo";

export { prerenderPaths } from "./route";

const ALLOWED_METHODS: ReadonlyArray<string> = ["GET", "HEAD"];

// NOTE: Without these the browser finds the fonts only after parsing the stylesheet, paints the
// text in a fallback and then swaps it.
const fontPreload = (href: string): string =>
  `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`;

const FONT_PRELOADS = Array.join(
  Array.map([geistLatin, geistPixelLatin, geistMonoLatin], fontPreload),
  ""
);

export const renderDocument: Server.DocumentRenderer = (application, assets) =>
  Server.renderDocument(application, assets, {
    head: `${Seo.Head.pageHead(application.title)}${Seo.Head.SITE_HEAD}${FONT_PRELOADS}`,
  });

const methodNotAllowed = (): Server.EntryResult =>
  Server.Responded(
    new Response(null, {
      status: 405,
      headers: { allow: Array.join(ALLOWED_METHODS, ", ") },
    })
  );

const badRequest = (): Server.EntryResult =>
  Server.Responded(new Response("Bad Request", { status: 400 }));

const renderUrl = (url: Url.Url) =>
  Effect.map(
    Server.renderToString(
      { routing: {}, init, view },
      { url: Url.toString(url) }
    ),
    (renderedApplication) =>
      Server.Rendered(renderedApplication, {
        status: urlToAppRoute(url)._tag === "NotFound" ? 404 : 200,
      })
  );

const respondTo = (request: Request) =>
  Effect.gen(function* () {
    if (!Array.contains(ALLOWED_METHODS, request.method)) {
      return methodNotAllowed();
    }

    return yield* Option.match(Url.fromString(request.url), {
      onNone: () => Effect.succeed(badRequest()),
      onSome: renderUrl,
    });
  });

export const renderPage = async (
  request: Request
): Promise<Server.EntryResult> => await Effect.runPromise(respondTo(request));
