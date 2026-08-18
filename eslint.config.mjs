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
    // Vendored third-party components, kept byte-for-byte as their registry
    // ships them so a re-add or upgrade applies cleanly. They are excluded
    // from lint because reformatting them to our style would be exactly the
    // local modification we want to avoid — TypeScript still type-checks them.
    "src/components/originkit/**",
  ]),
]);

export default eslintConfig;
