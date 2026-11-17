#!/usr/bin/env bun
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";

import PackageJson from "../package.json" with { type: "json" };
import { cli } from "./cli.ts";

const program = Command.run(cli, { version: PackageJson.version }).pipe(
  Effect.provide(BunServices.layer)
);

BunRuntime.runMain(program);
