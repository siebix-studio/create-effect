import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { Resvg } from "@resvg/resvg-js";
import { Array, Effect, Option } from "effect";
import satori from "satori";
import type { Font } from "satori";

import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "../src/seo/og-image.ts";
import { SITE_NAME, SITE_URL } from "../src/site.ts";

export type OgCard = Readonly<{
  title: string;
  footer: string;
}>;

type CardNode = Readonly<{
  type: string;
  props: Readonly<{
    style: Readonly<Record<string, string | number>>;
    children: string | ReadonlyArray<CardNode | string>;
  }>;
}>;

const SITE_HOST = new URL(SITE_URL).host;

// FONT

const PIXEL_FONT = "Geist Pixel";

const SANS_FONT = "Geist";

const MONO_FONT = "Geist Mono";

type FontFile = Readonly<{ name: string; weight: 400 | 500; file: string }>;

const FONT_FILES: ReadonlyArray<FontFile> = [
  {
    name: PIXEL_FONT,
    weight: 400,
    file: "@fontsource/geist-pixel/files/geist-pixel-latin-400-normal.woff",
  },
  {
    name: SANS_FONT,
    weight: 400,
    file: "@fontsource/geist/files/geist-latin-400-normal.woff",
  },
  {
    name: MONO_FONT,
    weight: 500,
    file: "@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff",
  },
];

const resolveFromHere = createRequire(import.meta.url);

const toFont = ({ name, weight }: FontFile, data: Buffer): Font => ({
  name,
  weight,
  style: "normal",
  data,
});

const loadFont = (fontFile: FontFile) =>
  Effect.map(
    Effect.promise(
      async () => await readFile(resolveFromHere.resolve(fontFile.file))
    ),
    (data) => toFont(fontFile, data)
  );

const loadFonts = Effect.forEach(FONT_FILES, loadFont, {
  concurrency: "unbounded",
});

// TEMPLATE

type TitleSize = Readonly<{ maxLength: number; fontSize: number }>;

const TITLE_SIZES: ReadonlyArray<TitleSize> = [
  { maxLength: 24, fontSize: 96 },
  { maxLength: 48, fontSize: 80 },
  { maxLength: 72, fontSize: 64 },
];

const LONG_TITLE_SIZE = 56;

const titleSize = (title: string): number =>
  Option.match(
    Array.findFirst(TITLE_SIZES, ({ maxLength }) => title.length <= maxLength),
    { onNone: () => LONG_TITLE_SIZE, onSome: ({ fontSize }) => fontSize }
  );

const node = (
  style: CardNode["props"]["style"],
  children: CardNode["props"]["children"]
): CardNode => ({ type: "div", props: { style, children } });

const cardTree = ({ title, footer }: OgCard): CardNode =>
  node(
    {
      display: "flex",
      width: "100%",
      height: "100%",
      backgroundColor: "#fafafa",
    },
    [
      node(
        {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexGrow: 1,
          margin: 32,
          padding: 64,
          backgroundColor: "#ffffff",
          border: "2px solid #e5e5e5",
          borderRadius: 32,
          color: "#0a0a0a",
          fontFamily: SANS_FONT,
        },
        [
          node(
            { display: "flex", fontFamily: PIXEL_FONT, fontSize: 36 },
            SITE_NAME
          ),
          node(
            {
              display: "flex",
              fontFamily: PIXEL_FONT,
              fontSize: titleSize(title),
              lineHeight: 1.1,
              textWrap: "balance",
            },
            title
          ),
          node(
            {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 30,
              color: "#525252",
            },
            [
              node({ fontFamily: MONO_FONT, fontWeight: 500 }, footer),
              node({ color: "#a3a3a3" }, SITE_HOST),
            ]
          ),
        ]
      ),
    ]
  );

// RENDER

export const renderOgCard = (card: OgCard): Effect.Effect<Uint8Array> =>
  Effect.gen(function* () {
    const fonts = yield* loadFonts;

    const svg = yield* Effect.promise(
      async () =>
        await satori(cardTree(card), {
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          fonts,
        })
    );

    return new Resvg(svg).render().asPng();
  });
