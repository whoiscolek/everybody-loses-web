import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "public/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["api/**/*.js", "shared/**/*.js", "tests/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  }
];
