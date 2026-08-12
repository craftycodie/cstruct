import { defineConfig } from "vitepress";

export default defineConfig({
  title: "cstruct",
  titleTemplate: ":title · @craftycodie/cstruct",
  description:
    "Schema-first packed binary layouts for TypeScript — c.struct schemas, optional class decorators, and Buffer I/O.",
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
          { text: "Class decorators", link: "/guide/class-decorators" },
          { text: "Type helpers", link: "/guide/type-helpers" },
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
        text: "Field types",
        collapsed: false,
        items: [
          { text: "Overview", link: "/guide/field-types/" },
          { text: "Custom types", link: "/guide/field-types/custom-types" },
          { text: "Bool", link: "/guide/field-types/bool" },
          { text: "String", link: "/guide/field-types/string" },
          { text: "WString", link: "/guide/field-types/wstring" },
          { text: "Time64", link: "/guide/field-types/time64" },
          { text: "Bitfield", link: "/guide/field-types/bitfield" },
          { text: "Magic fields", link: "/guide/field-types/magic" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Example structures", link: "/guide/example-structures" },
          { text: "Vitest", link: "/guide/vitest" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Struct I/O API", link: "/guide/api" },
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
