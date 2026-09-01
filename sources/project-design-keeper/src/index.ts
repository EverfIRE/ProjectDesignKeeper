import {
  createScopeService,
  detectDrift,
  queryContext,
  resolveScope,
  scanScope,
  searchEvidence,
  snapshot
} from "./scope/index.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { connectStdioServer, createMcpServer } from "./mcp.js";
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
  const mcpService = {
    ...scope,
    queryHistory: (input: Record<string, unknown>) => queryHistory(input, options),
    analyzeRedundancy: (input: Record<string, unknown>) => analyzeRedundancy(input, options),
    validatePack: validatePackWithOptions,
    ...transactions
  };
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
    queryHistory: mcpService.queryHistory,
    analyzeRedundancy: mcpService.analyzeRedundancy,
    validatePack: validatePackWithOptions,
    previewUpdate: transactions.previewUpdate,
    inspectChangesetForApproval: transactions.inspectChangesetForApproval,
    applyUpdate,
    createMcpServer: async () => createMcpServer(mcpService),
    connectStdioServer: async () => connectStdioServer(mcpService)
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

export function isDirectExecution(metaUrl: string, argv: string[] = process.argv): boolean {
  if (!argv[1]) return false;
  return metaUrl === pathToFileURL(resolve(argv[1])).href;
}

if (isDirectExecution(import.meta.url)) {
  void projectDesignKeeper.connectStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Failed to start Project Design Keeper MCP server";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
