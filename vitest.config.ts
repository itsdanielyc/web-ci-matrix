// L1 unit, L2 contract and L3 integration all run on Vitest in Node; the
// npm scripts pick a level by folder (vitest run tests/unit, and so on).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/{unit,contract,integration}/**/*.test.ts"],
    environment: "node",
  },
});
