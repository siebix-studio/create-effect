import * as Markdown from "@foldkit/markdown";
import { Array } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

// NOTE: This is the file Changesets writes on every release, so the page never needs updating by
// hand. The markdown plugin compiles it at build time; the browser receives data, not a parser.
import changelogSource from "../../cli/CHANGELOG.md";
import { homeRouter } from "./route";
import { SITE_NAME } from "./site";
import {
  CODE_BLOCK_CLASS,
  INLINE_CODE_CLASS,
  LINK_CLASS,
  SECTION_HEADING_CLASS,
} from "./ui";

const PACKAGE_TITLE_LEVEL = 1;
const VERSION_LEVEL = 2;

const isPackageTitle = (block: Markdown.Block): boolean =>
  block._tag === "Heading" && block.level === PACKAGE_TITLE_LEVEL;

// NOTE: Changesets opens the file with the package name as its title. The page has its own
// heading, so that one is left out.
const releases: Markdown.MarkdownDocument = {
  blocks: Array.filter(
    Markdown.decodeDocument(changelogSource).blocks,
    (block) => !isPackageTitle(block)
  ),
};

const views = <Message>(h: HtmlBuilder<Message>): Partial<Markdown.Views> => ({
  Heading: ({ level }, content) =>
    level <= VERSION_LEVEL
      ? h.h2([h.Class(`mt-8 first:mt-0 ${SECTION_HEADING_CLASS}`)], content)
      : h.h3(
          [h.Class("font-sans text-sm font-medium text-neutral-500")],
          content
        ),
  Paragraph: (_paragraph, content) =>
    h.p([h.Class("text-pretty text-neutral-600")], content),
  Link: ({ url }, content) => h.a([h.Href(url), h.Class(LINK_CLASS)], content),
  InlineCode: ({ value }) => h.code([h.Class(INLINE_CODE_CLASS)], [value]),
  CodeBlock: ({ value }) =>
    h.pre([h.Class(CODE_BLOCK_CLASS)], [h.code([], [value])]),
  List: ({ isOrdered }, items) =>
    isOrdered
      ? h.ol([h.Class("grid list-decimal gap-4 pl-5")], items)
      : h.ul([h.Class("grid gap-4")], items),
  ListItem: (_listItem, blocks) => h.li([h.Class("grid gap-2")], blocks),
});

export const view = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("grid gap-12")],
    [
      h.header(
        [h.Class("grid gap-6")],
        [
          h.a(
            [
              h.Href(homeRouter()),
              h.Class(`justify-self-start text-neutral-600 ${LINK_CLASS}`),
            ],
            [SITE_NAME]
          ),
          h.h1(
            [h.Class("text-5xl leading-none text-balance sm:text-7xl")],
            ["Changelog"]
          ),
        ]
      ),
      h.section(
        [h.Class("grid gap-4")],
        Markdown.viewBlocks(releases, { views: views(h) })
      ),
    ]
  );
