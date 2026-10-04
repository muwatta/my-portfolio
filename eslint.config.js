import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist"] },

  {
    files: ["scripts/**/*.js", "supabase/**/*.js", "vite.config.js", "api/**/*.js"],
    languageOptions: {
      // 2022 rather than 2020: class fields such as `onmessage = null` are
      // ES2022, and the build already runs through a toolchain that handles them.
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: "module",
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  {
    files: ["**/*.{js,jsx}"],

    languageOptions: {
      // Matches the version above. At 2020 the parser rejected valid class fields
      // as a syntax error, which is a false alarm rather than a real defect.
      ecmaVersion: 2022,
      globals: globals.browser,

      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },

    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^[A-Z_]|^motion$",
          argsIgnorePattern: "^[A-Z_]",
        },
      ],

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
