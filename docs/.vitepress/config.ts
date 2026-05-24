import { defineConfig } from "vitepress";

export default defineConfig({
  title: "@craftycodie/cstruct",
  description:
    "A TypeScript NPM Package for reading and writing packed binary layouts.",
  base: "/cstruct/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/quick-start" },
      { text: "API", link: "/guide/api" },
      {
        text: "GitHub",
        link: "https://github.com/craftycodie/cstruct",
      },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is cstruct?", link: "/" },
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
        icon: "github",
        link: "https://github.com/craftycodie/cstruct",
      },
    ],
  },
});
