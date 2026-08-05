import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Legacy fetch-on-mount client pages, written before the server-component
    // conversion. The rule stays on for all new code; delete entries here as
    // each page moves to the server.
    files: [
      "app/(portal)/**/page.tsx",
      "app/admin/page.tsx",
      "components/CookieNotice.tsx",
      "components/portal/usePortalState.ts",
      "components/ui/ThemeToggle.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
