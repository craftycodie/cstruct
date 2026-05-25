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
          { text: "Bitfield enums", link: "/guide/bitfields" },
          { text: "Advanced fields", link: "/guide/advanced-fields" },
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
        items: [{ text: "Struct I/O API", link: "/guide/api" }],
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
