import {
  createScopeService,
  detectDrift,
  queryContext,
  resolveScope,
  scanScope,
  searchEvidence,
  snapshot
} from "./scope/index.js";
import { createTransactionService, resolveCacheDirectory } from "./transactions.js";
import { validatePack, type ServiceOptions } from "./types/schema.js";
import { queryHistory } from "./knowledge/history.js";
import { analyzeRedundancy } from "./knowledge/redundancy.js";

export function createProjectDesignKeeper(options: ServiceOptions = {}) {
  const trustedApprovalProvider = options.trustedApprovalProvider;
  const transactions = createTransactionService(options);
  const scope = createScopeService(options);
  const validatePackWithOptions = (input: Record<string, unknown>) => validatePack(input, {
    limits: options.limits,
    io: options.validationIo
  });
  const applyUpdate = async (input: Record<string, unknown>) => {
    if (!trustedApprovalProvider) {
      throw new Error("Direct apply requires a trusted approval provider");
    }
    const binding = await transactions.inspectChangesetForApproval(input);
    const decision = await trustedApprovalProvider(binding);
    if (decision?.approved !== true) throw new Error("Trusted approval provider declined the apply request");
    const requestIdentity = Object.freeze({ directApply: true });
    const authorization = transactions.issueApplyAuthorization(binding, requestIdentity);
    return transactions.applyUpdate(input, authorization, requestIdentity);
  };
  return {
    ...scope,
    queryHistory: (input: Record<string, unknown>) => queryHistory(input, options),
    analyzeRedundancy: (input: Record<string, unknown>) => analyzeRedundancy(input, options),
    validatePack: validatePackWithOptions,
    previewUpdate: transactions.previewUpdate,
    inspectChangesetForApproval: transactions.inspectChangesetForApproval,
    issueApplyAuthorization: transactions.issueApplyAuthorization,
    applyUpdateDirect: transactions.applyUpdate,
    applyUpdate
  };
}

export {
  analyzeRedundancy,
  detectDrift,
  queryContext,
  queryHistory,
  resolveCacheDirectory,
  resolveScope,
  scanScope,
  searchEvidence,
  snapshot,
  validatePack
};

export type { CandidateModule, ResolvedScope, ScanResult, ScopeInput, ServiceOptions } from "./types/schema.js";

export const projectDesignKeeper = createProjectDesignKeeper();
