import tsParser from "@typescript-eslint/parser";
import reactCompiler from "oxc-plugin-react-compiler/eslint";

/** Rust React Compiler lint (run via `pnpm lint:react-compiler`). */
export default [
  {
    ignores: [
      "**/routeTree.gen.ts",
      "**/node_modules/**",
      "**/dist/**",
      "**/.output/**",
      "packages/**",
      "extension/**",
      "src/design-system/**",
    ],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "off",
    },
    files: ["src/**/*.{ts,tsx}"],
    ...reactCompiler.configs.recommended,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
