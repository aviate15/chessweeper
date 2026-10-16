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
  prettier,
);
