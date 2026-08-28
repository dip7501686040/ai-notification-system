import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.venv/**",
      "**/generated/**",
      "**/.next/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // k6 scripts run in k6's own JS runtime, not Node -- console is one of
    // the few globals it shares with Node (no `process`, no `require`;
    // modules come from k6's own `k6/*` import specifiers instead), so
    // this only needs to add the one global actually used here rather
    // than pull in a full env preset.
    files: ["loadtest/**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
  },
);
