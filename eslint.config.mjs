import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    ".agents/**",
    ".mastra/**",
    ".vercel/**",
    "node_modules/**",
    "dist/**",
    "storage/**",
    "src/.mastra/**",
    "src/mastra/public/**",
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.mjs",
            "*.js",
            "*.cjs",
            "*.config.ts",
            "neon.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ project: "./tsconfig.json" }),
      ],
    },
    rules: {
      // Functions deploy unbundled to Node ESM, which does not resolve
      // extensionless relative specifiers. `.js` is mandatory; `.ts` never is.
      "import-x/extensions": ["error", "ignorePackages", { ts: "never" }],
      "import-x/no-cycle": "error",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Numbers read unambiguously inside a template; the default only
      // allows strings, which forces noisy String() wrappers.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],

      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "no-console": "error",

      // Both rules fight framework vocabulary (req, res, env, repo) and
      // contradict each other on the same identifiers; the rest of the unicorn
      // readability set stays on.
      "unicorn/prevent-abbreviations": "off",
      "unicorn/name-replacements": "off",
      // Counts fluent builder chains such as zod's `z.string().trim().min(1)`,
      // which have no more readable form. Real nesting is bounded by
      // `max-depth`, `complexity`, and `sonarjs/cognitive-complexity`.
      "unicorn/max-nested-calls": "off",
      // libsql rows and Mastra result types use null as a first-class value;
      // auto-rewriting it to undefined would silently break that interop.
      "unicorn/no-null": "off",
      // `void promise` is the documented way to mark an intentional
      // fire-and-forget for @typescript-eslint/no-floating-promises;
      // no-meaningless-void-operator still catches pointless uses.
      "sonarjs/void-use": "off",
    },
  },

  {
    // Tests, evals, and CLI scripts print to the terminal by design.
    files: ["**/*.test.ts", "src/evals/**", "scripts/**"],
    rules: {
      "max-lines-per-function": "off",
      "max-lines": "off",
      "no-console": "off",
      // Fixtures deliberately hold private and link-local addresses to prove
      // the public-URL guard rejects them.
      "sonarjs/no-hardcoded-ip": "off",
    },
  },

  {
    // The plugins export their flat configs as default-export members; this
    // is the documented import shape, not an accidental named/default mix.
    files: ["eslint.config.mjs"],
    rules: {
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",
    },
  },

  prettier,
]);
