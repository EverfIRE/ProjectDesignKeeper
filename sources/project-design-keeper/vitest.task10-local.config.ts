import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/task10-local.acceptance.ts"],
    testTimeout: 10_000,
    maxWorkers: 1
  }
});
