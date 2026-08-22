import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Legacy fetch-on-mount client components. The rule stays on for all new
    // code; delete entries here as each file is modernised.
    files: [
      "app/admin/page.tsx",
      "components/CookieNotice.tsx",
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
    // The Expo app is its own package, with its own toolchain, its own lockfile
    // and its own linter (`npm run lint` inside mobile/, which is `expo lint`).
    // This config is eslint-config-next — Next.js rules, wrong for React
    // Native — so it stays out, exactly as tsconfig.json already excludes it.
    "mobile/**",
  ]),
]);

export default eslintConfig;
