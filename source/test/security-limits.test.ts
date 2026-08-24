import { describe, expect, test, vi } from "vitest";
import { performance } from "node:perf_hooks";
import {
  ByteBudget,
  CounterBudget,
  DeadlineBudget,
  assertArrayWithin,
  assertSerializedWithin,
  assertStringWithin,
  assertToolResultBudget,
  keeperLimits,
  mcpToolResultBudgetBytes,
  mcpToolResultEnvelopeReserveBytes,
  resolveKeeperLimits,
  serializedBytes,
  type KeeperLimitOverrides
} from "../src/security/limits.js";

function assertDeepLimitContracts(): KeeperLimitOverrides {
  const overrides: KeeperLimitOverrides = { preview: { maxChanges: 1 } };
  // @ts-expect-error Hard limits are deeply readonly.
  keeperLimits.preview.maxChanges = 1;
  // @ts-expect-error Resolved limits are deeply readonly.
  resolveKeeperLimits().pack.maxRecords = 1;
  return overrides;
}

void assertDeepLimitContracts;

describe("runtime resource limits", () => {
  test("rejects serialized input before business work", () => {
    expect(() => assertSerializedWithin("MCP arguments", { value: "x".repeat(64) }, 32))
      .toThrow(/MCP arguments.*32 bytes/i);
  });

  test("byte and time budgets fail on the first exceeded unit", () => {
    const bytes = new ByteBudget("scan bytes", 10);
    bytes.consume(10);
    expect(() => bytes.consume(1)).toThrow(/scan bytes.*10/i);

    const deadline = new DeadlineBudget("cold scan", 5, (() => {
      let now = 0;
      return () => ++now * 5;
    })());
    expect(() => deadline.check()).toThrow(/cold scan.*deadline/i);
    expect(keeperLimits.preview.maxChanges).toBe(200);
  });

  test("count and direct-value guards stop at their declared limits", () => {
    const records = new CounterBudget("records", 2);
    records.consume(2);
    expect(() => records.consume(1)).toThrow(/records.*2/i);
    expect(() => assertArrayWithin("changes", [1, 2, 3], 2)).toThrow(/changes.*2/i);
    expect(() => assertStringWithin("query", "你你", 5)).toThrow(/query.*5 bytes/i);
  });

  test("clamps test limit overrides to immutable production ceilings", () => {
    const resolved = resolveKeeperLimits({
      mcpArgumentBytes: keeperLimits.mcpArgumentBytes + 1,
      preview: { ...keeperLimits.preview, maxChanges: keeperLimits.preview.maxChanges + 1 }
    });
    expect(resolved.mcpArgumentBytes).toBe(8 * 1024 * 1024);
    expect(resolved.preview.maxChanges).toBe(200);
  });

  test("applies every tighter nested override without weakening a hard ceiling", () => {
    const resolved = resolveKeeperLimits({
      mcpArgumentBytes: 1,
      preview: { maxChanges: 1, maxFileBytes: 2, maxAggregateBytes: 3, maxDiffBytes: 4 },
      changesets: {
        maxPairsPerProject: 5,
        maxPairsGlobal: 6,
        maxTotalBytes: 7,
        maxChangesetBytes: 8,
        maxSignatureBytes: 9
      },
      pack: { maxDocuments: 10, maxRecords: 11, maxEvidencePerRecord: 12, maxImpactPerRecord: 13 },
      scan: { maxFiles: 14, maxFileBytes: 15, maxAggregateBytes: 16, maxEvidence: 17, deadlineMs: 18 },
      redundancy: { maxRecords: 19, maxPairs: 20, maxDecisions: 21 }
    });

    expect(resolved).toEqual({
      mcpArgumentBytes: 1,
      preview: { maxChanges: 1, maxFileBytes: 2, maxAggregateBytes: 3, maxDiffBytes: 4 },
      changesets: {
        maxPairsPerProject: 5,
        maxPairsGlobal: 6,
        maxTotalBytes: 7,
        maxChangesetBytes: 8,
        maxSignatureBytes: 9
      },
      pack: { maxDocuments: 10, maxRecords: 11, maxEvidencePerRecord: 12, maxImpactPerRecord: 13 },
      scan: { maxFiles: 14, maxFileBytes: 15, maxAggregateBytes: 16, maxEvidence: 17, deadlineMs: 18 },
      redundancy: { maxRecords: 19, maxPairs: 20, maxDecisions: 21 }
    });
  });

  test("rejects unsafe overrides, consumption, and direct-value types", () => {
    expect(() => resolveKeeperLimits({ scan: { maxFiles: -1 } })).toThrow(/scan files.*non-negative integer/i);
    expect(() => new ByteBudget("bytes", -1)).toThrow(/bytes.*non-negative integer/i);
    expect(() => new CounterBudget("items", 0.5)).toThrow(/items.*non-negative integer/i);

    const bytes = new ByteBudget("bytes", 10);
    expect(() => bytes.consume(-1)).toThrow(/consumption.*non-negative integer/i);
    const items = new CounterBudget("items", 10);
    expect(() => items.consume(0.5)).toThrow(/consumption.*non-negative integer/i);
    expect(() => assertArrayWithin("changes", "not-an-array", 1)).toThrow(/must be an array/i);
    expect(() => assertStringWithin("query", 1, 1)).toThrow(/must be a string/i);
  });

  test("fails closed for non-serializable values and enforces the response envelope reserve", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializedBytes(cyclic)).toThrow(/cannot be serialized/i);
    expect(() => serializedBytes(undefined)).toThrow(/cannot be serialized/i);
    expect(() => assertToolResultBudget({ value: "x".repeat(mcpToolResultBudgetBytes) }))
      .toThrow(/one MiB response budget/i);
    expect(() => assertToolResultBudget({
      value: "x".repeat(mcpToolResultBudgetBytes - mcpToolResultEnvelopeReserveBytes - 32)
    })).not.toThrow();
  });

  test("uses monotonic time for its default deadline clock", () => {
    const monotonicNow = vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(105);
    const wallClockNow = vi.spyOn(Date, "now").mockReturnValue(0);
    try {
      const deadline = new DeadlineBudget("cold scan", 5);
      expect(() => deadline.check()).toThrow(/cold scan.*deadline/i);
      expect(monotonicNow).toHaveBeenCalledTimes(2);
      expect(wallClockNow).not.toHaveBeenCalled();
    } finally {
      monotonicNow.mockRestore();
      wallClockNow.mockRestore();
    }
  });
});
