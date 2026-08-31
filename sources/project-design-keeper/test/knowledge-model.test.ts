import { describe, expect, test } from "vitest";
import { assessRecord, type EvidenceRef } from "../src/knowledge/model.js";

const evidence = (role: EvidenceRef["role"]): EvidenceRef => ({
  path: "Source/design.txt",
  startLine: 1,
  role,
  excerptHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
});

describe("record evidence confidence ceilings", () => {
  test.each([
    ["intent", "not-required", [evidence("implementation")], "medium"],
    ["principle", "confirmed", [evidence("implementation")], "high"],
    ["decision", "not-required", [evidence("design")], "high"],
    ["architecture", "not-required", [evidence("design"), evidence("implementation")], "high"],
    ["module", "not-required", [evidence("implementation")], "medium"],
    ["convention", "not-required", [evidence("design")], "medium"],
    ["tuning", "not-required", [evidence("configuration"), evidence("test")], "high"],
    ["tuning", "not-required", [evidence("configuration"), evidence("runtime")], "high"],
    ["tuning", "not-required", [evidence("configuration")], "medium"],
    ["verification", "not-required", [evidence("runtime")], "high"],
    ["verification", "not-required", [evidence("test")], "medium"],
    ["open-question", "pending", [evidence("design")], "medium"],
    ["architecture", "not-required", [], "low"]
  ] as const)("caps %s records from their evidence roles", (kind, approval, supportingEvidence, expected) => {
    expect(assessRecord({
      id: `record.${kind}`,
      kind,
      approval,
      assertedConfidence: "high",
      evidence: [...supportingEvidence]
    }).effectiveConfidence).toBe(expected);
  });

  test("never raises asserted confidence to the evidence ceiling", () => {
    expect(assessRecord({
      id: "record.low",
      kind: "decision",
      approval: "confirmed",
      assertedConfidence: "low",
      evidence: [evidence("design")]
    })).toEqual({ id: "record.low", effectiveConfidence: "low", reasons: [] });
  });
});
