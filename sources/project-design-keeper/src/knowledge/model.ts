export type FreshnessStatus = "fresh" | "stale" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type EvidenceRole = "design" | "implementation" | "test" | "configuration" | "runtime";

export interface EvidenceRef {
  path: string;
  startLine: number;
  endLine?: number;
  role: EvidenceRole;
  excerptHash: `sha256:${string}`;
}

export type RecordLifecycle =
  | { state: "active" }
  | {
    state: "terminal";
    reason: "superseded" | "resolved" | "replaced" | "merged";
    sinceRevision: number;
    confirmedRefreshes: number;
    successorIds: string[];
  };

export interface AccuracyRecord {
  id: string;
  kind?: string;
  approval?: string;
  assertedConfidence?: Confidence;
  evidence: Array<string | EvidenceRef>;
}

export interface RecordAssessment {
  id: string;
  effectiveConfidence: Confidence;
  reasons: string[];
}

const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const confidenceByRank = ["low", "medium", "high"] as const;

function typedEvidence(record: AccuracyRecord): EvidenceRef[] {
  return record.evidence.filter((value): value is EvidenceRef => typeof value !== "string");
}

function ceiling(record: AccuracyRecord): { confidence: Confidence; reason?: string } {
  const evidence = typedEvidence(record);
  if (evidence.length === 0) return { confidence: "low", reason: "no typed evidence supports this record" };
  const roles = new Set(evidence.map((value) => value.role));
  switch (record.kind) {
    case "intent":
    case "principle":
    case "decision":
      return record.approval === "confirmed" || roles.has("design")
        ? { confidence: "high" }
        : { confidence: "medium", reason: "high confidence requires confirmation or normative design evidence" };
    case "architecture":
    case "module":
    case "convention":
      return roles.has("design") && roles.has("implementation")
        ? { confidence: "high" }
        : { confidence: "medium", reason: "high confidence requires both normative design and implementation evidence" };
    case "tuning":
      return roles.has("configuration") && (roles.has("test") || roles.has("runtime"))
        ? { confidence: "high" }
        : { confidence: "medium", reason: "high confidence requires configuration plus test or runtime evidence" };
    case "verification":
      return roles.has("runtime")
        ? { confidence: "high" }
        : { confidence: "medium", reason: "a test definition without a current result is capped at medium" };
    default:
      return { confidence: roles.size > 0 ? "medium" : "low" };
  }
}

export function assessRecord(record: AccuracyRecord): RecordAssessment {
  const asserted = record.assertedConfidence ?? "low";
  const evidenceCeiling = ceiling(record);
  const effectiveRank = Math.min(confidenceRank[asserted], confidenceRank[evidenceCeiling.confidence]);
  const effectiveConfidence = confidenceByRank[effectiveRank];
  return {
    id: record.id,
    effectiveConfidence,
    reasons: evidenceCeiling.reason && confidenceRank[asserted] > confidenceRank[evidenceCeiling.confidence]
      ? [evidenceCeiling.reason]
      : []
  };
}
