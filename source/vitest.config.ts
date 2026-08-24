import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 80,
        "src/knowledge/archive.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/knowledge/model.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/security/approval.ts": {
          lines: 100,
          statements: 100,
          branches: 100
        },
        "src/security/cache.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/security/cursor.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/security/limits.ts": {
          lines: 95,
          statements: 95,
          branches: 85
        },
        "src/security/process-liveness.ts": {
          lines: 100,
          statements: 100,
          branches: 85
        },
        "src/security/process-lock.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/security/publication-claim.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/changesets/store.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/scope/reader.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/scope/store.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/scope/pagination.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/knowledge/history-integrity.ts": {
          lines: 90,
          statements: 90,
          branches: 85
        },
        "src/mcp.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/transactions.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/scope/index.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/knowledge/history.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        },
        "src/knowledge/redundancy.ts": {
          lines: 85,
          statements: 85,
          branches: 80
        }
      }
    }
  }
});
