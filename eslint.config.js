// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // The engine is pure: no DOM, no network, no clock, RNG injected (CLAUDE.md).
    files: ["packages/engine/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["Date", "setTimeout", "setInterval", "fetch", "crypto", "window", "document"].map(
          (name) => ({ name, message: "The engine is pure: inject time and randomness." }),
        ),
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the injected Rng." },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: ["ws", "react"],
          patterns: [{ group: ["node:*"], message: "The engine must not depend on Node." }],
        },
      ],
    },
  },
  {
    // Hidden-information fence (design doc 3.2): client-facing view code builds fresh objects
    // field by field. It never reads `.hidden`, spreads objects or copies wholesale.
    files: [
      "packages/engine/src/view/public.ts",
      "packages/engine/src/view/client.ts",
      "packages/engine/src/view/flags.ts",
      "packages/engine/src/view/errors.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='hidden']",
          message: "Client views must not read hidden state. Use a named public helper.",
        },
        {
          selector: "ObjectExpression > SpreadElement",
          message: "Build view objects field by field. Never spread engine objects.",
        },
        {
          selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign']",
          message: "Build view objects field by field. Never copy engine objects.",
        },
      ],
    },
  },
  prettier,
);
