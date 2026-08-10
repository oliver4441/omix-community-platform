import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / committed artifacts that aren't source:
    "dist/**",
    "graphify-out/**",
    // Node scripts (CommonJS require() is intentional here):
    "scripts/**",
    "netlify/functions/**",
  ]),
]);

export default eslintConfig;
