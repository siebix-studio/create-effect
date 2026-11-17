import { Array, Effect, Option } from "effect";
import { Server } from "foldkit/experimental";
import * as Url from "foldkit/url";

import { init, view } from "./main";
import { urlToAppRoute } from "./route";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export { prerenderPaths } from "./route";

const ALLOWED_METHODS: ReadonlyArray<string> = ["GET", "HEAD"];

const metaTag = (
  attribute: "name" | "property",
  key: string,
  content: string
): string => `<meta ${attribute}="${key}" content="${content}">`;

const HEAD = Array.join(
  [
    metaTag("name", "description", SITE_DESCRIPTION),
    metaTag("property", "og:type", "website"),
    metaTag("property", "og:site_name", SITE_NAME),
    metaTag("property", "og:description", SITE_DESCRIPTION),
  ],
  ""
);

export const renderDocument: Server.DocumentRenderer = (application, assets) =>
  Server.renderDocument(application, assets, { head: HEAD });

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
