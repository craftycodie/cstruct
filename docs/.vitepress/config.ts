import { defineConfig } from "vitepress";

export default defineConfig({
  title: "cstruct",
  titleTemplate: ":title · @craftycodie/cstruct",
  description:
    "Stage 3 struct decorators for reading and writing packed binary layouts in TypeScript.",
  base: "/cstruct/",
  cleanUrls: true,
  appearance: "force-dark",
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  head: [
    ["meta", { name: "theme-color", content: "#7c3aed" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&display=swap",
      },
    ],
  ],
  themeConfig: {
    logo: { text: "cstruct" },
    nav: [
      { text: "Guide", link: "/guide/quick-start" },
      { text: "API", link: "/guide/api" },
      { text: "Changelog", link: "/changelog" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/@craftycodie/cstruct",
      },
      {
        text: "GitHub",
        link: "https://github.com/craftycodie/cstruct",
      },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Install & setup", link: "/guide/install" },
          { text: "Quick start", link: "/guide/quick-start" },
        ],
      },
      {
        text: "Layouts",
        items: [
          { text: "Primitives & padding", link: "/guide/primitives" },
          { text: "Nested structs", link: "/guide/nested-structs" },
          { text: "Unions", link: "/guide/unions" },
          { text: "Enums", link: "/guide/enums" },
          { text: "Arrays", link: "/guide/arrays" },
        ],
      },
      {
        text: "Advanced fields",
        collapsed: false,
        items: [
          { text: "Overview", link: "/guide/advanced-fields/" },
          { text: "Custom types", link: "/guide/advanced-fields/custom-types" },
          { text: "Bool", link: "/guide/advanced-fields/bool" },
          { text: "String", link: "/guide/advanced-fields/string" },
          { text: "WString", link: "/guide/advanced-fields/wstring" },
          { text: "U64 / I64", link: "/guide/advanced-fields/int64" },
          { text: "Time64", link: "/guide/advanced-fields/time64" },
          { text: "Bitfield", link: "/guide/advanced-fields/bitfield" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Example structures", link: "/guide/example-structures" },
          { text: "Vitest & SWC", link: "/guide/vitest" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Struct I/O API", link: "/guide/api" },
          { text: "JSON encoding", link: "/guide/json" },
          { text: "Changelog", link: "/changelog" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/@craftycodie/cstruct",
        ariaLabel: "npm",
      },
      {
        icon: "github",
        link: "https://github.com/craftycodie/cstruct",
      },
    ],
    footer: {
      message: "MIT Licensed",
      copyright:
        'Copyright © <a href="https://github.com/craftycodie/cstruct" target="_blank" rel="noopener noreferrer">craftycodie</a>',
    },
  },
});
