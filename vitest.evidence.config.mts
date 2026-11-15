/**
 * Same test suite as vitest.config.mts, plus machine-readable evidence:
 *   docs/test-results/vitest-results.json   — every test with its status and duration
 *   docs/test-results/acceptance-evidence.json — values observed by the acceptance tests
 * Used by `npm run test:evidence`.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.mts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      reporters: ["default", "json"],
      outputFile: { json: "docs/test-results/vitest-results.json" },
      env: { ASTRA_TEST_EVIDENCE: "docs/test-results/acceptance-evidence.json" },
    },
  }),
);
