import { defineConfig } from "vitest/config";

// Standalone vitest config for the BrainAgent plugin — the repository's
// root config only picks up packages/*/*/tests/**/*.spec.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/modules/**/*.test.ts"],
  },
});
