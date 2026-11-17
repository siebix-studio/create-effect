import { Schema, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion } from "foldkit/route";

export const AppRoute = defineRouteUnion({
  Home: {},
  Changelog: {},
  NotFound: { path: Schema.String },
});

export type AppRoute = typeof AppRoute.Type;

export const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Home));

export const changelogRouter = pipe(
  Route.literal("changelog"),
  Route.mapTo(AppRoute.Changelog)
);

/** Every path the build prerenders. */
export const prerenderPaths: ReadonlyArray<string> = [
  homeRouter(),
  changelogRouter(),
];

const routeParser = Route.oneOf(homeRouter, changelogRouter);

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound
);
