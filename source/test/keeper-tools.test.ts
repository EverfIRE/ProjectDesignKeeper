import { Context } from "@deepseek-ai/cordis";
import { CallId } from "@deepseek-ai/dsh-llm";
import AgentRegistry, { type Agent } from "@deepseek-ai/dsh-agent";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type JsonValue } from "@deepseek-ai/dsh-tools";
import UserQuestionService from "@deepseek-ai/dsh-user-questions";
import ApprovalService, { type ApprovalOutcome } from "@deepseek-ai/dsh-user-approval";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as keeperPlugin from "../src/plugin.js";
import { createProjectDesignKeeper } from "../src/index.js";
import { registerKeeperTools, type NativeApplyApproval, type NativeKeeperService } from "../src/tools/keeper-tools.js";
import { keeperLimits } from "../src/security/limits.js";
import type { ApplyAuthorization, ChangesetApprovalBinding } from "../src/security/approval.js";
import { writeCanonicalPackFixture } from "./canonical-pack-fixture.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

const expectedTools = [
  "analyze_redundancy",
  "apply_update",
  "detect_drift",
  "preview_update",
  "query_context",
  "query_history",
  "scan_scope",
  "search_evidence",
  "validate_pack"
] as const;

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function currentFixture(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function fakeAgent(id = "keeper-test-agent"): Agent {
  return {
    id,
    session: {
      id,
      events: [{ type: "turn/start" }, { type: "user/message" }],
      append: (_type: string, data: Record<string, unknown>) => ({ type: "event", data })
    }
  } as unknown as Agent;
}

let callSeq = 0;

async function callTool(ctx: Context, name: string, args: Record<string, unknown>, agent?: Agent) {
  callSeq += 1;
  return ctx.tools.execute({
    signal: new AbortController().signal,
    callId: CallId(`keeper-call-${callSeq}`),
    name,
    arguments: args,
    ...(agent !== undefined ? { agent } : {})
  });
}

function digestBinding(overrides: Partial<ChangesetApprovalBinding> = {}): ChangesetApprovalBinding {
  return {
    root: "C:\\canonical-project",
    changesetId: "123e4567-e89b-12d3-a456-426614174000",
    diffDigest: `sha256:${"a".repeat(64)}`,
    expiresAt: Date.now() + 60_000,
    paths: ["docs/project-design/index.md"],
    summary: { create: 1, update: 0, delete: 0 },
    archiveActions: { archivedRecordIds: [], tombstonedRecordIds: [] },
    semanticDecisionIds: ["record.required"],
    ...overrides
  } as ChangesetApprovalBinding;
}

function stubService(overrides: Partial<NativeKeeperService> = {}): NativeKeeperService {
  const echo = async (input: Record<string, unknown>) => ({ received: input });
  const inspectChangesetForApproval = vi.fn(async (input: Record<string, unknown>): Promise<ChangesetApprovalBinding> => {
    const adapter = input.changeset as Record<string, unknown> | undefined;
    return digestBinding({
      root: String(input.root),
      changesetId: String(input.changesetId ?? adapter?.changesetId)
    });
  });
  return {
    scanScope: vi.fn(echo),
    searchEvidence: vi.fn(echo),
    detectDrift: vi.fn(echo),
    queryContext: vi.fn(echo),
    queryHistory: vi.fn(echo),
    analyzeRedundancy: vi.fn(echo),
    previewUpdate: vi.fn(echo),
    inspectChangesetForApproval,
    issueApplyAuthorization: vi.fn(() => Object.freeze({}) as ApplyAuthorization),
    applyUpdateDirect: vi.fn(echo),
    validatePack: vi.fn(echo),
    ...overrides
  };
}

async function stubSetup(
  service: NativeKeeperService,
  approvalOverrides: Partial<NativeApplyApproval> = {}
): Promise<Context> {
  const ctx = new Context();
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(UserQuestionService);
  await ctx.plugin(ApprovalService);
  registerKeeperTools((tool) => {
    ctx.tools.register(tool);
  }, service, {
    approval: ctx.approval,
    userQuestions: ctx.userQuestions,
    requireDigestConfirmation: true,
    ...approvalOverrides
  });
  return ctx;
}

function approveEverything(ctx: Context): void {
  ctx.on("approval/request", () => Promise.resolve<ApprovalOutcome>("allowed-once"));
}

function expectToolError(result: Awaited<ReturnType<Context["tools"]["execute"]>>, pattern: RegExp): void {
  expect(result.isError).toBe(true);
  const text = result.content.map((block) => block.type === "text" ? block.text : "").join("\n");
  expect(text).toMatch(pattern);
}

describe("Project Design Keeper native tools", () => {
  test("registers exactly nine tools with the expected parameter schemas", async () => {
    const ctx = await stubSetup(stubService());
    const schemas = ctx.tools.schemas();
    expect(schemas.map((tool) => tool.name).sort()).toEqual([...expectedTools].sort());

    const byName = Object.fromEntries(schemas.map((tool) => [tool.name, tool]));
    const expectedProperties: Record<string, string[]> = {
      scan_scope: ["root", "path", "previousSnapshot", "view", "cursor", "limit"],
      search_evidence: ["root", "path", "query", "domain", "domains", "status", "statuses"],
      detect_drift: ["root", "path", "previousSnapshot", "sourceRevision", "pack", "requiredEvidence", "view", "cursor", "limit"],
      query_context: ["root", "path", "query", "paths", "module", "modules", "maxRecords", "maxEvidence"],
      query_history: ["root", "query", "recordIds", "paths", "modules", "includeTombstones", "cursor", "limit"],
      analyze_redundancy: ["root", "query", "paths", "modules"],
      preview_update: ["root", "path", "changes", "expectedContentHash", "pack", "analysisId", "redundancyDecisions"],
      apply_update: ["root", "changesetId", "changeset"],
      validate_pack: ["root", "pack"]
    };
    const expectedRequired: Record<string, string[]> = {
      scan_scope: [],
      search_evidence: ["query"],
      detect_drift: [],
      query_context: [],
      query_history: ["root"],
      analyze_redundancy: ["root"],
      preview_update: ["root", "changes"],
      apply_update: ["root"],
      validate_pack: ["root", "pack"]
    };

    for (const [name, propertyNames] of Object.entries(expectedProperties)) {
      const schema = byName[name] as {
        parameters?: { properties?: Record<string, unknown>; required?: string[] };
      };
      const parameters = schema.parameters as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      expect(Object.keys(parameters.properties ?? {}).sort()).toEqual([...propertyNames].sort());
      expect([...(parameters.required ?? [])].sort()).toEqual([...expectedRequired[name]].sort());
      expect(JSON.stringify(schema)).not.toMatch(/"(?:approved|approval|confirmation|token|nonce|digest|diffDigest)"\s*:/iu);
    }
  });

  test("rejects invalid inputs at the schema boundary without service work", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const agent = fakeAgent();
    ctx.agents.register(agent);

    for (const request of [
      { name: "scan_scope", arguments: {} },
      { name: "scan_scope", arguments: { root: "C:/project", previousSnapshot: 42 } },
      { name: "scan_scope", arguments: { root: "C:/project", view: "everything" } },
      { name: "scan_scope", arguments: { root: "C:/project", limit: 1001 } },
      { name: "detect_drift", arguments: { root: "C:/project", sourceRevision: 42 } },
      { name: "apply_update", arguments: { root: "C:/project" } },
      { name: "apply_update", arguments: { root: "C:/project", changeset: { changesetId: 42 } } },
      { name: "apply_update", arguments: { root: "C:/project", changesetId: 42 } }
    ]) {
      const result = await callTool(ctx, request.name, request.arguments, agent);
      expect(result.isError).toBe(true);
    }
    expect(service.scanScope).not.toHaveBeenCalled();
    expect(service.detectDrift).not.toHaveBeenCalled();
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("rejects schema-valid arguments over 8 MiB without service work", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const result = await callTool(ctx, "validate_pack", {
      root: "C:/project",
      pack: { extension: "x".repeat(keeperLimits.mcpArgumentBytes) }
    });
    expect(result.isError).toBe(true);
    expect(service.validatePack).not.toHaveBeenCalled();
  });

  test("rejects oversized preview change lists without service work", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const result = await callTool(ctx, "preview_update", {
      root: "C:/project",
      changes: Array.from({ length: 201 }, (_, index) => ({
        path: `docs/project-design/${index}.md`,
        content: "x"
      }))
    });
    expect(result.isError).toBe(true);
    expect(service.previewUpdate).not.toHaveBeenCalled();
  });

  test("refuses apply without a live calling agent", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    });
    expect(result.isError).toBe(true);
    expectToolError(result, /live calling agent/u);
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("fails closed when the approval outcome is not a grant", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const agent = fakeAgent();
    ctx.agents.register(agent);
    ctx.on("approval/request", () => Promise.resolve<ApprovalOutcome>("rejected"));

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(true);
    expectToolError(result, /declined/u);
    expect(service.issueApplyAuthorization).not.toHaveBeenCalled();
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("fails closed when no approval answerer is composed", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const agent = fakeAgent();
    ctx.agents.register(agent);

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(true);
    expectToolError(result, /unavailable/u);
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("rejects a digest confirmation that does not match", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const agent = fakeAgent();
    ctx.agents.register(agent);
    approveEverything(ctx);
    ctx.userQuestions.registerProvider({
      async ask() {
        return { answers: [{ id: "keeper-apply-digest", selected: [], custom: "deadbeef" }] };
      }
    });

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(true);
    expectToolError(result, /digest confirmation does not match/u);
    expect(service.issueApplyAuthorization).not.toHaveBeenCalled();
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("applies after approval and matching digest confirmation", async () => {
    const service = stubService();
    const ctx = await stubSetup(service);
    const agent = fakeAgent();
    ctx.agents.register(agent);
    approveEverything(ctx);
    const seenDigest: string[] = [];
    ctx.userQuestions.registerProvider({
      async ask(request) {
        const question = request.questions[0];
        const suffix = /\(([a-f0-9]{8})\)/u.exec(question.question)?.[1] ?? "";
        seenDigest.push(suffix);
        return { answers: [{ id: question.id, selected: [], custom: suffix }] };
      }
    });

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(false);
    expect(seenDigest).toEqual(["aaaaaaaa"]);
    expect(service.issueApplyAuthorization).toHaveBeenCalledTimes(1);
    expect(service.applyUpdateDirect).toHaveBeenCalledTimes(1);
    const issuedIdentity = vi.mocked(service.issueApplyAuthorization).mock.calls[0][1];
    const appliedIdentity = vi.mocked(service.applyUpdateDirect).mock.calls[0][2];
    expect(appliedIdentity).toBe(issuedIdentity);
  });

  test("applies with approval only when digest confirmation is disabled", async () => {
    const service = stubService();
    const ctx = await stubSetup(service, { requireDigestConfirmation: false });
    const agent = fakeAgent();
    ctx.agents.register(agent);
    approveEverything(ctx);

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(false);
    expect(service.applyUpdateDirect).toHaveBeenCalledTimes(1);
  });

  test("fails closed when digest confirmation is required but user-questions is absent", async () => {
    const service = stubService();
    const ctx = new Context();
    await ctx.plugin(AgentRegistry);
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    await ctx.plugin(ApprovalService);
    registerKeeperTools((tool) => {
      ctx.tools.register(tool);
    }, service, {
      approval: ctx.approval,
      requireDigestConfirmation: true
    });
    const agent = fakeAgent();
    ctx.agents.register(agent);
    approveEverything(ctx);

    const result = await callTool(ctx, "apply_update", {
      root: "C:/project",
      changesetId: "123e4567-e89b-12d3-a456-426614174000"
    }, agent);
    expect(result.isError).toBe(true);
    expectToolError(result, /user-questions capability.*not mounted/u);
    expect(service.applyUpdateDirect).not.toHaveBeenCalled();
  });

  test("scans a real fixture project through the mounted plugin", async () => {
    const cacheDirectory = await mkdtemp(join(tmpdir(), "keeper-native-scan-"));
    try {
      const ctx = await fullSetup({ cacheDirectory });
      const agent = fakeAgent();
      ctx.agents.register(agent);
      const result = await callTool(ctx, "scan_scope", { root: currentFixture().repository, view: "summary" }, agent);
      expect(result.isError).toBe(false);
      const value = (result as { value?: JsonValue }).value as Record<string, unknown>;
      expect(value).toMatchObject({ snapshotId: expect.any(String), totals: expect.any(Object) });
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
    }
  });

  test("previews and applies a change-set end to end through the mounted plugin", async () => {
    const cacheDirectory = await mkdtemp(join(tmpdir(), "keeper-native-apply-"));
    try {
      const ctx = await fullSetup({ cacheDirectory });
      const agent = fakeAgent();
      ctx.agents.register(agent);
      approveEverything(ctx);
      ctx.userQuestions.registerProvider({
        async ask(request) {
          const question = request.questions[0];
          const suffix = /\(([a-f0-9]{8})\)/u.exec(question.question)?.[1] ?? "";
          return { answers: [{ id: question.id, selected: [], custom: suffix }] };
        }
      });

      const target = join(currentFixture().repository, ".agents", "skills", "project-design-context", "native.md");
      const preview = await callTool(ctx, "preview_update", {
        root: currentFixture().repository,
        changes: [{
          path: ".agents/skills/project-design-context/native.md",
          managedBlock: {
            recordId: "native.record",
            content: "# Native approval\n\nNATIVE-FILE-BODY\n"
          }
        }]
      }, agent);
      expect(preview.isError).toBe(false);
      const previewValue = (preview as { value?: JsonValue }).value as Record<string, unknown>;
      expect(previewValue).toMatchObject({ changesetId: expect.any(String) });

      const applied = await callTool(ctx, "apply_update", {
        root: currentFixture().repository,
        changesetId: String(previewValue.changesetId)
      }, agent);
      expect(applied.isError).toBe(false);
      const appliedValue = (applied as { value?: JsonValue }).value as Record<string, unknown>;
      expect(appliedValue).toMatchObject({ changesetId: String(previewValue.changesetId) });

      const written = await readFile(target, "utf8");
      expect(written).toContain("NATIVE-FILE-BODY");
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
    }
  });

  test("validates a canonical pack through the mounted plugin", async () => {
    const cacheDirectory = await mkdtemp(join(tmpdir(), "keeper-native-pack-"));
    try {
      const project = currentFixture();
      const result = await writeCanonicalPackFixture(project);
      expect(result).toBeDefined();
      const ctx = await fullSetup({ cacheDirectory });
      const agent = fakeAgent();
      ctx.agents.register(agent);
      const validated = await callTool(ctx, "validate_pack", {
        root: project.repository,
        pack: { schemaVersion: "3.0", documents: [], records: [] }
      }, agent);
      expect(validated.isError).toBe(false);
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
    }
  });
});

async function fullSetup(config: Partial<keeperPlugin.Config> = {}): Promise<Context> {
  const ctx = new Context();
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(UserQuestionService);
  await ctx.plugin(ApprovalService);
  await ctx.plugin(keeperPlugin, config);
  return ctx;
}
