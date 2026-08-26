import { z } from "zod";
import { assertStringWithin, keeperLimits } from "../security/limits.js";

/** Tool invocation arguments as received from the harness registry. */
export type ParameterRecord = Record<string, unknown>;

/**
 * Input validation schemas for the Project Design Keeper tools.
 *
 * These were extracted verbatim from the former MCP tool layer (`src/mcp.ts`)
 * and keep the exact byte budgets, formats, and shape constraints that the
 * stdio MCP server enforced. The native DeepSeek Harness plugin parses every
 * tool invocation against these schemas before dispatching to the keeper
 * services, so the model-visible parameter description and the enforced input
 * contract cannot drift apart.
 */

function boundedString(maxBytes: number, minimum = 0) {
  return z.string().min(minimum).max(maxBytes).superRefine((value, context) => {
    try {
      assertStringWithin("tool string", value, maxBytes);
    } catch (error) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Tool string exceeds its byte limit" });
    }
  });
}

export const nonemptyString = boundedString(4 * 1024, 1);
export const nonemptyQuery = boundedString(32 * 1024, 1);
export const queryString = boundedString(32 * 1024);
export const proposedFileContent = boundedString(keeperLimits.preview.maxFileBytes);
export const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const fingerprintRecord = z.record(fingerprint);
export const snapshotInput = z.union([
  fingerprintRecord,
  z.object({ files: fingerprintRecord }).passthrough()
]);
export const sourceRevisionInput = z.object({ files: fingerprintRecord }).passthrough();
export const changesetAdapterInput = z.object({ changesetId: nonemptyString }).strict();
export const stringOrStrings = z.union([nonemptyString, z.array(nonemptyString).nonempty().max(1_000)]);
export const scopeFields = {
  root: nonemptyString.optional(),
  path: nonemptyString.optional()
};
export const pageLimit = z.number().int().min(1).max(1000);

export function scoped<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...scopeFields, ...shape }).strict();
}

export const scanInput = scoped({
  previousSnapshot: snapshotInput.optional(),
  view: z.enum(["summary", "files", "evidence"]).optional(),
  cursor: nonemptyString.optional(),
  limit: pageLimit.optional()
});
export const searchInput = scoped({
  query: nonemptyQuery,
  domain: stringOrStrings.optional(),
  domains: stringOrStrings.optional(),
  status: stringOrStrings.optional(),
  statuses: stringOrStrings.optional()
});
export const driftInput = scoped({
  previousSnapshot: snapshotInput.optional(),
  sourceRevision: sourceRevisionInput.optional(),
  pack: z.record(z.unknown()).optional(),
  requiredEvidence: z.array(nonemptyString).max(keeperLimits.pack.maxEvidencePerRecord).optional(),
  view: z.enum(["summary", "details"]).optional(),
  cursor: nonemptyString.optional(),
  limit: pageLimit.optional()
});
export const contextInput = scoped({
  query: queryString.optional(),
  paths: z.array(nonemptyString).max(1_000).optional(),
  path: nonemptyString.optional(),
  module: stringOrStrings.optional(),
  modules: stringOrStrings.optional(),
  maxRecords: z.number().int().min(1).max(100).optional(),
  maxEvidence: z.number().int().min(1).max(500).optional()
});
export const historyInput = z.object({
  root: nonemptyString,
  query: queryString.optional(),
  recordIds: z.array(nonemptyString).max(1_000).optional(),
  paths: z.array(nonemptyString).max(1_000).optional(),
  modules: z.array(nonemptyString).max(1_000).optional(),
  includeTombstones: z.boolean().optional(),
  cursor: nonemptyString.optional(),
  limit: z.number().int().min(1).max(500).optional()
}).strict();
export const redundancyInput = z.object({
  root: nonemptyString,
  query: queryString.optional(),
  paths: z.array(nonemptyString).max(1_000).optional(),
  modules: z.array(nonemptyString).max(1_000).optional()
}).strict();
export const validateInput = z.object({
  root: nonemptyString,
  pack: z.record(z.unknown())
}).strict();

export const managedBlock = z.union([
  z.object({ recordId: nonemptyString, content: proposedFileContent }).strict(),
  z.object({ recordId: nonemptyString, delete: z.literal(true) }).strict()
]);
export const expectedContentHash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const requestedChange = z.union([
  z.object({
    path: nonemptyString,
    content: proposedFileContent,
    expectedContentHash: expectedContentHash.optional()
  }).strict(),
  z.object({
    path: nonemptyString,
    delete: z.literal(true),
    expectedContentHash: expectedContentHash.optional()
  }).strict(),
  z.object({
    path: nonemptyString,
    managedBlock,
    expectedContentHash: expectedContentHash.optional()
  }).strict()
]);
export const previewInput = z.object({
  root: nonemptyString,
  path: nonemptyString.optional(),
  changes: z.array(requestedChange).nonempty().max(keeperLimits.preview.maxChanges),
  expectedContentHash: expectedContentHash.optional(),
  pack: z.record(z.unknown()).optional(),
  analysisId: nonemptyString.optional(),
  redundancyDecisions: z.array(z.object({
    candidateId: nonemptyString,
    decision: z.enum(["merge", "keep-separate", "defer"]),
    survivorId: nonemptyString.optional()
  }).strict()).nonempty().max(keeperLimits.redundancy.maxDecisions).optional()
}).strict();
export const applyInput = z.object({
  root: nonemptyString,
  changesetId: nonemptyString.optional(),
  changeset: changesetAdapterInput.optional()
}).strict();

/** Parse one tool invocation with the enforcing schema; throws on violation. */
export function parseToolInput<T extends z.ZodTypeAny>(schema: T, input: Record<string, unknown>): z.output<T> {
  return schema.parse(input);
}
