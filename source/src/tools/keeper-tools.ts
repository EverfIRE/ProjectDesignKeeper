import { defineTool, type JsonValue, type ToolRunContext } from "@deepseek-ai/dsh-tools";
import type { ApprovalService } from "@deepseek-ai/dsh-user-approval";
import type { UserQuestionService } from "@deepseek-ai/dsh-user-questions";
import { assertSerializedWithin, assertToolResultBudget, keeperLimits } from "../security/limits.js";
import type { ApplyAuthorization, ChangesetApprovalBinding } from "../security/approval.js";
import { parseToolInput, applyInput, contextInput, driftInput, historyInput, previewInput, redundancyInput, scanInput, searchInput, validateInput, type ParameterRecord } from "./schemas.js";
import { elicitApplyApproval } from "./apply-approval.js";
import type { z } from "zod";

/**
 * Native DeepSeek Harness tools for Project Design Keeper.
 *
 * Every former MCP tool becomes a first-party harness tool registered on
 * `ctx.tools` through `defineTool`. The model-visible parameter schemas mirror
 * the MCP input contracts; the enforcing zod schemas from `schemas.ts` still
 * parse every invocation so byte budgets and shape constraints are unchanged.
 * The one behavioural difference is apply approval: instead of MCP elicitation
 * it uses the harness approval seam (`ctx.approval`) plus an optional digest
 * confirmation through `ctx.userQuestions`.
 */

/** Keeper services the native tools dispatch to. */
export interface NativeKeeperService {
  scanScope(input: Record<string, unknown>): Promise<object>;
  searchEvidence(input: Record<string, unknown>): Promise<object>;
  detectDrift(input: Record<string, unknown>): Promise<object>;
  queryContext(input: Record<string, unknown>): Promise<object>;
  queryHistory(input: Record<string, unknown>): Promise<object>;
  analyzeRedundancy(input: Record<string, unknown>): Promise<object>;
  previewUpdate(input: Record<string, unknown>): Promise<object>;
  inspectChangesetForApproval(input: Record<string, unknown>): Promise<ChangesetApprovalBinding>;
  issueApplyAuthorization(binding: ChangesetApprovalBinding, requestIdentity: object): ApplyAuthorization;
  applyUpdateDirect(input: Record<string, unknown>, authorization?: ApplyAuthorization, requestIdentity?: object): Promise<object>;
  validatePack(input: Record<string, unknown>): Promise<object>;
}

/** Approval wiring the apply tool elicits through. */
export interface NativeApplyApproval {
  approval: ApprovalService;
  userQuestions?: UserQuestionService;
  requireDigestConfirmation: boolean;
}

const readOnly = {
  schema: { type: "object", additionalProperties: true },
  render: (_args: unknown, value: JsonValue) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
} as const;

function requireScope(input: Record<string, unknown>): void {
  if (!input.root && !input.path) throw new Error("A repository root or path is required");
}

function keeperOperation(
  schema: z.ZodTypeAny,
  operation: (input: Record<string, unknown>) => Promise<object>,
  scopeCheck = false
) {
  return async (args: ParameterRecord, _exec: ToolRunContext): Promise<Record<string, JsonValue>> => {
    assertSerializedWithin("Tool arguments", args, keeperLimits.mcpArgumentBytes);
    const input = parseToolInput(schema, args);
    if (scopeCheck) requireScope(input);
    const value = await operation(input as Record<string, unknown>);
    assertToolResultBudget(value);
    return value as Record<string, JsonValue>;
  };
}

function requireApplyChangeset(input: Record<string, unknown>): void {
  const adapter = input.changeset as Record<string, unknown> | undefined;
  if (!input.changesetId && !adapter?.changesetId) throw new Error("A changeset id is required");
}

/** Register all Project Design Keeper tools on `ctx.tools`. */
export function registerKeeperTools(
  register: (tool: ReturnType<typeof defineTool>) => void,
  service: NativeKeeperService,
  approval: NativeApplyApproval
): void {
  register(defineTool({
    name: "scan_scope",
    description: "Scan a repository scope and return a bounded summary or cursor-paged files/evidence for an immutable snapshot.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to scope." },
      previousSnapshot: { type: "json", description: "Prior immutable snapshot to compare against." },
      view: { type: "string", enum: ["summary", "files", "evidence"], description: "Which bounded projection to return." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-1000)." }
    },
    output: readOnly,
    execute: keeperOperation(scanInput, service.scanScope, true)
  }));

  register(defineTool({
    name: "search_evidence",
    description: "Search repository evidence by query and optional design classifications.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to search within." },
      query: { type: "string", required: true, description: "Search query text." },
      domain: { type: "string", description: "Design domain filter (string or array)." },
      domains: { type: "string", description: "Design domain filter (string or array)." },
      status: { type: "string", description: "Evidence status filter (string or array)." },
      statuses: { type: "string", description: "Evidence status filter (string or array)." }
    },
    output: readOnly,
    execute: keeperOperation(searchInput, service.searchEvidence, true)
  }));

  register(defineTool({
    name: "detect_drift",
    description: "Compare current source evidence with a prior snapshot or design pack.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to scope." },
      previousSnapshot: { type: "json", description: "Prior immutable snapshot to compare against." },
      sourceRevision: { type: "json", description: "Source revision fingerprints." },
      pack: { type: "object", additionalProperties: true, description: "Design pack whose required evidence is checked." },
      requiredEvidence: { type: "array", items: { type: "string" }, description: "Evidence selectors that must be supported." },
      view: { type: "string", enum: ["summary", "details"], description: "Detail level of the drift report." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-1000)." }
    },
    output: readOnly,
    execute: keeperOperation(driftInput, service.detectDrift, true)
  }));

  register(defineTool({
    name: "query_context",
    description: "Return the smallest relevant design context for a task, path, or module.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path whose context is loaded." },
      query: { type: "string", description: "Free-text relevance query." },
      paths: { type: "array", items: { type: "string" }, description: "Explicit repository-relative paths to load." },
      module: { type: "string", description: "Module selector (string or array)." },
      modules: { type: "string", description: "Module selector (string or array)." },
      maxRecords: { type: "number", description: "Maximum design records to return (1-100)." },
      maxEvidence: { type: "number", description: "Maximum evidence entries to return (1-500)." }
    },
    output: readOnly,
    execute: keeperOperation(contextInput, service.queryContext, true)
  }));

  register(defineTool({
    name: "query_history",
    description: "Query stale, terminal, archived, and optionally tombstoned project-design knowledge.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      query: { type: "string", description: "Free-text history query." },
      recordIds: { type: "array", items: { type: "string" }, description: "Explicit record ids to load." },
      paths: { type: "array", items: { type: "string" }, description: "Repository-relative paths to filter by." },
      modules: { type: "array", items: { type: "string" }, description: "Module names to filter by." },
      includeTombstones: { type: "boolean", description: "Whether tombstoned records are included." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-500)." }
    },
    output: readOnly,
    execute: keeperOperation(historyInput, service.queryHistory)
  }));

  register(defineTool({
    name: "analyze_redundancy",
    description: "Find deterministic semantic-redundancy candidates for explicit Agent and user decisions.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      query: { type: "string", description: "Free-text query to focus analysis." },
      paths: { type: "array", items: { type: "string" }, description: "Repository-relative paths to filter by." },
      modules: { type: "array", items: { type: "string" }, description: "Module names to filter by." }
    },
    output: readOnly,
    execute: keeperOperation(redundancyInput, service.analyzeRedundancy)
  }));

  register(defineTool({
    name: "preview_update",
    description: "Validate a proposed managed update, store an expiring change-set in keeper cache, and return its diff and conflicts without changing the project.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      path: { type: "string", description: "Optional path constraint for the change-set." },
      changes: {
        type: "array",
        required: true,
        description: "Proposed changes (write, delete, or managed-block updates).",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            path: { type: "string", required: true, description: "Repository-relative output path." },
            content: { type: "string", description: "Full replacement content." },
            delete: { type: "boolean", description: "True deletes the path." },
            managedBlock: {
              type: "object",
              additionalProperties: true,
              description: "Managed project-design block update.",
              properties: {
                recordId: { type: "string", required: true },
                content: { type: "string", description: "Replacement block content." },
                delete: { type: "boolean", description: "True deletes the managed block." }
              }
            },
            expectedContentHash: { type: "string", description: "sha256:... expected current content hash." }
          }
        }
      },
      expectedContentHash: { type: "string", description: "sha256:... expected current content hash." },
      pack: { type: "object", additionalProperties: true, description: "Candidate design pack." },
      analysisId: { type: "string", description: "Id pairing redundancy decisions with the pack." },
      redundancyDecisions: {
        type: "array",
        description: "User decisions on redundancy candidates.",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            candidateId: { type: "string", required: true },
            decision: { type: "string", required: true, enum: ["merge", "keep-separate", "defer"] },
            survivorId: { type: "string" }
          }
        }
      }
    },
    output: readOnly,
    execute: keeperOperation(previewInput, service.previewUpdate)
  }));

  register(defineTool({
    name: "apply_update",
    description: "Apply one explicitly confirmed, unexpired change-set with optimistic concurrency and recovery snapshots.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      changesetId: { type: "string", description: "Id of the change-set returned by preview_update." },
      changeset: {
        type: "object",
        additionalProperties: true,
        description: "Change-set adapter (changeset.changesetId).",
        properties: {
          changesetId: { type: "string", required: true }
        }
      }
    },
    output: readOnly,
    async execute(args: ParameterRecord, exec: ToolRunContext): Promise<Record<string, JsonValue>> {
      assertSerializedWithin("Tool arguments", args, keeperLimits.mcpArgumentBytes);
      const input = parseToolInput(applyInput, args);
      requireApplyChangeset(input);
      const binding = await service.inspectChangesetForApproval(input);
      const { authorization, requestIdentity } = await elicitApplyApproval(
        approval,
        service.issueApplyAuthorization,
        binding,
        { callId: exec.callId, agent: exec.agent, signal: exec.signal }
      );
      const value = await service.applyUpdateDirect(input, authorization, requestIdentity);
      assertToolResultBudget(value);
      return value as Record<string, JsonValue>;
    }
  }));

  register(defineTool({
    name: "validate_pack",
    description: "Validate a project-design knowledge pack, links, records, evidence, and ownership metadata.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      pack: { type: "object", additionalProperties: true, required: true, description: "The design pack to validate." }
    },
    output: readOnly,
    execute: keeperOperation(validateInput, service.validatePack)
  }));
}
