import { Schema, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion } from "foldkit/route";

export const AppRoute = defineRouteUnion({
  Home: {},
  NotFound: { path: Schema.String },
});

export type AppRoute = typeof AppRoute.Type;

export const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Home));

/** Every path the build prerenders. */
export const prerenderPaths: ReadonlyArray<string> = [homeRouter()];

const routeParser = Route.oneOf(homeRouter);

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound
);
