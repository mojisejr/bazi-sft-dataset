import path from "path";

import { defineConfig } from "vitest/config";

const isHeavyLaneProfile = process.env.VITEST_BAZI_PROFILE === "heavy";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: isHeavyLaneProfile ? false : undefined,
    maxConcurrency: isHeavyLaneProfile ? 1 : undefined,
    testTimeout: isHeavyLaneProfile ? 30_000 : undefined,
    hookTimeout: isHeavyLaneProfile ? 30_000 : undefined,
  },
});