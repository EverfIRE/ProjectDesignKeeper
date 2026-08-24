import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const sampleCount = 20;
const maximumResponseBytes = 1024 * 1024;
const scenarios = new Set(["full", "scope-cache-smoke"]);

function hash(contents) {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

function percentile95(values) {
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * 0.95) - 1];
}

async function measured(operation) {
  const started = performance.now();
  const value = await operation();
  return { value, milliseconds: performance.now() - started };
}

function managed(recordId, content) {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function derived(documentId, content) {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:derived -->`;
}

async function createStrictSchema3Fixture(projectRoot) {
  const source = join(projectRoot, "Source");
  await mkdir(source, { recursive: true });
  const sourceFiles = Array.from({ length: 1000 }, (_, index) => {
    const name = `File${String(index).padStart(4, "0")}.txt`;
    const lines = Array.from({ length: 20 }, (__, line) => `${name} line ${line} bounded-index-content`).join("\n");
    return { name, contents: `${lines}\n` };
  });
  for (let offset = 0; offset < sourceFiles.length; offset += 32) {
    await Promise.all(sourceFiles.slice(offset, offset + 32).map(({ name, contents }) =>
      writeFile(join(source, name), contents, "utf8")));
  }

  const directory = join(projectRoot, "docs", "project-design");
  await mkdir(directory, { recursive: true });
  const documentKinds = new Map([
    ["intent.md", "intent"],
    ["principles.md", "principle"],
    ["architecture.md", "architecture"],
    ["conventions.md", "convention"],
    ["decisions.md", "decision"],
    ["tuning.md", "tuning"],
    ["verification.md", "verification"],
    ["open-questions.md", "open-question"]
  ]);
  const names = ["index.md", ...documentKinds.keys(), "evidence-map.md"];
  const documents = names.map((name) => ({
    id: `document.${name.replace(".md", "")}`,
    path: `docs/project-design/${name}`
  }));
  const knowledgeRecord = ({
    id,
    kind,
    ownerDocument,
    domain,
    scope,
    statement,
    evidence,
    impact,
    lifecycle = { state: "active" }
  }) => ({
    id,
    kind,
    ownerDocument,
    domain,
    scope,
    statement,
    evidence,
    impact,
    status: kind === "open-question" ? "proposed" : "observed",
    strength: kind === "open-question" ? "pending" : "informational",
    approval: kind === "open-question" ? "pending" : "not-required",
    assertedConfidence: "medium",
    lifecycle
  });
  const evidence = (index) => {
    const sourceFile = sourceFiles[index];
    return [{
      path: `Source/${sourceFile.name}`,
      startLine: 1,
      role: "implementation",
      excerptHash: hash(sourceFile.contents.split("\n", 1)[0])
    }];
  };
  const baseRecords = [...documentKinds].map(([name, kind]) => knowledgeRecord({
    id: `record.${kind}`,
    kind,
    ownerDocument: `document.${name.replace(".md", "")}`,
    domain: "performance-active",
    scope: "module:performance",
    statement: `The ${kind} record contains active-performance-token for current queries.`,
    evidence: evidence(0),
    impact: [`Measure ${kind} lookup with bounded shared resources.`]
  }));
  const redundancyPairCount = 256;
  const redundancyRecords = Array.from({ length: redundancyPairCount }, (_, pairIndex) => {
    const unique = String.fromCodePoint(0x4e00 + pairIndex);
    const pair = String(pairIndex).padStart(3, "0");
    return ["left", "right"].map((side) => knowledgeRecord({
      id: `record.performance-pair-${pair}-${side}`,
      kind: "decision",
      ownerDocument: "document.decisions",
      domain: "redundancy-performance-token",
      scope: `module:performance-pair-${pair}`,
      statement: `${unique.repeat(47)}${side === "left" ? "a" : "b"}`,
      evidence: evidence(pairIndex + 1),
      impact: [unique.repeat(12)]
    }));
  }).flat();
  const redundancyPackRecords = [...baseRecords, ...redundancyRecords];
  const renderDocument = (document, ownedRecords) => {
    const name = document.path.split("/").at(-1);
    const heading = `# ${document.id}\n`;
    const matchingRecords = ownedRecords.filter((record) => record.ownerDocument === document.id);
    return name === "index.md" || name === "evidence-map.md"
      ? derived(document.id, heading)
      : `${derived(document.id, heading)}${matchingRecords.map((record) => managed(record.id, `${record.statement}\n`)).join("")}`;
  };
  for (const document of documents) {
    await writeFile(join(projectRoot, ...document.path.split("/")), renderDocument(document, baseRecords), "utf8");
  }
  const archiveDirectory = join(directory, "archive");
  await mkdir(archiveDirectory, { recursive: true });
  const archivedRecord = knowledgeRecord({
    id: "record.history-performance-token-archived",
    kind: "decision",
    ownerDocument: "document.decisions",
    domain: "performance-history",
    scope: "module:performance",
    statement: "history-performance-token archived decision",
    evidence: evidence(0),
    impact: ["Exercise canonical archive retrieval."],
    lifecycle: {
      state: "terminal",
      reason: "merged",
      sinceRevision: 1,
      confirmedRefreshes: 2,
      successorIds: ["record.decision"]
    }
  });
  const archivedBody = "history-performance-token archived body";
  const archivePath = "docs/project-design/archive/generation-000001.records.jsonl";
  const tombstonePath = "docs/project-design/archive/tombstones.jsonl";
  await writeFile(join(archiveDirectory, "generation-000001.records.jsonl"), `${JSON.stringify({
    record: archivedRecord,
    originalOwnerDocument: "document.decisions",
    managedBody: archivedBody,
    contentHash: hash(archivedBody),
    evidenceHash: hash(JSON.stringify(archivedRecord.evidence)),
    terminalReason: "merged",
    maintenanceRevision: 1,
    archivedAt: "2026-08-15T00:00:00.000Z"
  })}\n`, "utf8");
  await writeFile(join(archiveDirectory, "tombstones.jsonl"), `${JSON.stringify({
    id: "record.history-performance-token-tombstone",
    reason: "resolved",
    successorIds: [],
    contentHash: hash("history-performance-token tombstone"),
    archivedAt: "2026-08-14T00:00:00.000Z"
  })}\n`, "utf8");
  const recordDigest = (record) => hash(JSON.stringify(record));
  const exactPair = redundancyRecords.slice(0, 2);
  const stalePair = redundancyRecords.slice(2, 4);
  const exactException = {
    leftId: exactPair[0].id,
    rightId: exactPair[1].id,
    leftDigest: recordDigest(exactPair[0]),
    rightDigest: recordDigest(exactPair[1])
  };
  const staleException = {
    leftId: stalePair[0].id,
    rightId: stalePair[1].id,
    leftDigest: recordDigest(stalePair[0]),
    rightDigest: hash("intentionally stale performance exception")
  };
  const revisionFiles = Object.fromEntries(sourceFiles.slice(0, redundancyPairCount + 1)
    .map((sourceFile) => [`Source/${sourceFile.name}`, hash(sourceFile.contents)]));
  const pack = {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 2,
    scope: { root: ".", paths: ["Source"] },
    sourceRevision: {
      kind: "working-tree",
      files: { "Source/File0000.txt": hash(sourceFiles[0].contents) }
    },
    documents,
    records: baseRecords,
    archive: {
      generations: [{
        id: "generation-000001",
        path: archivePath,
        recordCount: 1,
        createdAt: "2026-08-15T00:00:00.000Z"
      }],
      tombstones: { path: tombstonePath, count: 1 }
    },
    dedupeExceptions: []
  };
  const redundancyPack = {
    ...pack,
    sourceRevision: { kind: "working-tree", files: revisionFiles },
    records: redundancyPackRecords,
    dedupeExceptions: [exactException]
  };
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return {
    pack,
    redundancyPack,
    staleException,
    expandedDocuments: documents.map((document) => ({
      path: document.path,
      content: renderDocument(document, redundancyPackRecords)
    })),
    summary: {
      files: sourceFiles.length,
      canonicalCurrentRecords: baseRecords.length,
      redundancyCurrentRecords: redundancyPackRecords.length,
      redundancyRecords: redundancyRecords.length,
      archiveGenerations: 1,
      archivedRecords: 1,
      tombstones: 1,
      canonicalDedupeExceptions: 0,
      validatedDedupeExceptions: 1,
      runtimeDedupeExceptions: 2
    }
  };
}

function assertBoundedResponse(value) {
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > maximumResponseBytes) throw new Error(`Performance response exceeded 1 MiB: ${bytes} bytes`);
  return bytes;
}

function p95(values, label, limit) {
  if (values.length !== sampleCount) throw new Error(`${label} requires exactly ${sampleCount} hot samples`);
  const value = percentile95(values);
  if (value > limit) throw new Error(`${label} P95 exceeded ${limit}ms: ${value.toFixed(1)}ms`);
  return Number(value.toFixed(1));
}

function assertRepresentativeFullFixture(pack, requireStale) {
  const archive = pack.archive ?? {};
  const records = Array.isArray(pack.records) ? pack.records : [];
  const redundancyRecords = records.filter((record) => record.domain === "redundancy-performance-token");
  if (redundancyRecords.length < 512) {
    throw new Error("Full performance fixture requires at least 512 selected redundancy records");
  }
  if (!Array.isArray(archive.generations) || archive.generations.length < 1) {
    throw new Error("Full performance fixture requires a canonical archive generation");
  }
  if (!archive.tombstones || archive.tombstones.count < 1) {
    throw new Error("Full performance fixture requires at least one tombstone");
  }
  if (!Array.isArray(pack.dedupeExceptions) || pack.dedupeExceptions.length < 1) {
    throw new Error("Full performance fixture requires a digest-bound dedupe exception");
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  let exactExceptionCount = 0;
  let staleExceptionCount = 0;
  for (const exception of pack.dedupeExceptions) {
    const left = byId.get(exception.leftId);
    const right = byId.get(exception.rightId);
    if (!left || !right) continue;
    const exact = exception.leftDigest === hash(JSON.stringify(left))
      && exception.rightDigest === hash(JSON.stringify(right));
    if (exact) exactExceptionCount += 1;
    else staleExceptionCount += 1;
  }
  if (exactExceptionCount < 1 || staleExceptionCount !== (requireStale ? 1 : 0)) {
    throw new Error(requireStale
      ? "Full performance runtime fixture requires one exact binding and exactly one stale binding"
      : "Full performance canonical fixture must contain exact bindings and no stale bindings");
  }
  return {
    redundancyRecordIds: new Set(redundancyRecords.map((record) => record.id)),
    exactExceptionCount,
    staleExceptionCount,
    exactPairIds: pack.dedupeExceptions[0]
      ? [pack.dedupeExceptions[0].leftId, pack.dedupeExceptions[0].rightId]
      : [],
    stalePairIds: requireStale && pack.dedupeExceptions[1]
      ? [pack.dedupeExceptions[1].leftId, pack.dedupeExceptions[1].rightId]
      : []
  };
}

function assertDigestPass(digestCounts, expectedIds) {
  if (digestCounts.size !== expectedIds.size) {
    throw new Error(`Redundancy digest pass hashed ${digestCounts.size} records instead of ${expectedIds.size}`);
  }
  for (const id of expectedIds) {
    if (digestCounts.get(id) !== 1) throw new Error(`Redundancy digest pass did not hash ${id} exactly once`);
  }
}

function historySources(result) {
  return new Set((Array.isArray(result.items) ? result.items : []).map((item) => item.source));
}

function assertCanonicalActiveResult(result) {
  if (!Array.isArray(result.records) || result.records.length !== 8) {
    throw new Error("Full performance canonical active query must return exactly eight document-kind records");
  }
  if (result.freshness?.status !== "fresh" || (result.freshness.invalidatedRecordIds ?? []).length !== 0) {
    throw new Error("Full performance canonical active records must be fresh and fully verified");
  }
  const withheldCounts = Object.values(result.withheld?.counts ?? {});
  if (withheldCounts.some((count) => count !== 0) || (result.withheld?.records ?? []).length !== 0) {
    throw new Error("Full performance canonical active query must not withhold records");
  }
}

function assertCanonicalHistoryResult(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  const validSnapshot = typeof result.snapshotId === "string" && /^sha256:[a-f0-9]{64}$/u.test(result.snapshotId);
  if (result.schemaVersion !== 3 || !validSnapshot || items.length !== 2) {
    throw new Error("Full performance history query must return the exact canonical two-item envelope");
  }
  if (items[0]?.source !== "archive"
    || items[0]?.generationId !== "generation-000001"
    || items[0]?.record?.id !== "record.history-performance-token-archived"
    || items[1]?.source !== "tombstone"
    || items[1]?.tombstone?.id !== "record.history-performance-token-tombstone"
    || result.page?.limit !== 50
    || result.page?.complete !== true) {
    throw new Error("Full performance history query lost archive/tombstone ordering or identity");
  }
}

function candidateIdFor(leftId, rightId) {
  return hash(JSON.stringify(leftId <= rightId ? [leftId, rightId] : [rightId, leftId]));
}

function assertRepresentativeRedundancyResult(result, representative) {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const exactId = candidateIdFor(...representative.exactPairIds);
  const staleId = candidateIdFor(...representative.stalePairIds);
  const staleCandidate = candidates.find((candidate) => candidate.candidateId === staleId);
  if (result.schemaVersion !== 3
    || typeof result.analysisId !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(String(result.snapshotId ?? ""))
    || candidates.length !== 255
    || result.invalidatedExceptionCount !== 1
    || candidates.some((candidate) => candidate.candidateId === exactId)
    || !staleCandidate) {
    throw new Error("Full performance redundancy result must contain the exact 255 bounded candidates");
  }
  const expectedSurvivor = representative.stalePairIds[0];
  const requiredReasons = ["evidence-overlap", "impact-overlap", "same-kind", "same-scope", "same-owner"];
  if (staleCandidate.recommendedSurvivorId !== expectedSurvivor
    || staleCandidate.decision !== null
    || requiredReasons.some((reason) => !staleCandidate.reasons?.includes(reason))) {
    throw new Error("Full performance stale-exception candidate lost its deterministic identity or reasons");
  }
}

const argumentsAfterScript = process.argv.slice(2);
if (argumentsAfterScript.length !== 2 || argumentsAfterScript[0] !== "--scenario" || !scenarios.has(argumentsAfterScript[1])) {
  throw new Error("Performance runner requires --scenario full|scope-cache-smoke");
}
const scenario = argumentsAfterScript[1];
const runtimePath = process.env.KEEPER_PERF_RUNTIME
  ? resolve(process.env.KEEPER_PERF_RUNTIME)
  : resolve(import.meta.dirname, "..", "dist", "index.js");
const { createProjectDesignKeeper } = await import(pathToFileURL(runtimePath).href);
const temporary = await mkdtemp(join(tmpdir(), "project-design-keeper-perf-"));
const configuredRoot = process.env.KEEPER_PERF_ROOT;
const projectRoot = configuredRoot ? resolve(configuredRoot) : join(temporary, "project");
const cacheDirectory = join(temporary, "cache");

try {
  const fixture = configuredRoot
    ? {
        pack: JSON.parse(await readFile(join(projectRoot, "docs", "project-design", "manifest.json"), "utf8")),
        summary: undefined,
        staleException: undefined,
        redundancyPack: undefined,
        expandedDocuments: undefined
      }
    : await createStrictSchema3Fixture(projectRoot);
  const pack = fixture.pack;
  if (pack.schemaVersion !== "3.0") throw new Error("Performance fixture must use strict Schema 3.0");

  let discoveryReads = 0;
  let contentReads = 0;
  let digestCounts = new Map();
  let redundancyContentReads = 0;
  const api = createProjectDesignKeeper({
    cacheDirectory,
    scopeIo: {
      beforeRepositoryDiscovery: async () => { discoveryReads += 1; },
      beforeRepositoryContentRead: async () => { contentReads += 1; }
    },
    redundancyIo: {
      onRecordDigest: (id) => digestCounts.set(id, (digestCounts.get(id) ?? 0) + 1),
      beforeRepositoryContentRead: async () => { redundancyContentReads += 1; }
    }
  });
  const validation = await api.validatePack({ root: projectRoot, pack });
  if (validation.valid !== true) throw new Error(`Performance Schema 3.0 fixture is invalid: ${JSON.stringify(validation.errors)}`);
  let representative;
  if (scenario === "full") {
    if (configuredRoot || !fixture.staleException || !fixture.redundancyPack || !fixture.expandedDocuments) {
      throw new Error("Full representative performance requires the isolated synthetic fixture; unset KEEPER_PERF_ROOT");
    }
  }

  const cold = await measured(() => api.scanScope({ root: projectRoot, view: "files", limit: 1 }));
  const cursor = cold.value.page?.nextCursor;
  if (!cursor || discoveryReads < 1 || contentReads < 1) {
    throw new Error("Performance cold scan did not build an instrumented cursor snapshot");
  }
  if (cold.milliseconds > 60_000) throw new Error(`Cold index exceeded 60000ms: ${cold.milliseconds.toFixed(1)}ms`);
  let maxResponseBytes = assertBoundedResponse(cold.value);

  discoveryReads = 0;
  contentReads = 0;
  const cursorTimes = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const page = await measured(() => api.scanScope({ root: projectRoot, view: "files", limit: 1, cursor }));
    cursorTimes.push(page.milliseconds);
    maxResponseBytes = Math.max(maxResponseBytes, assertBoundedResponse(page.value));
  }
  const cursorRepositoryReads = discoveryReads + contentReads;
  if (cursorRepositoryReads !== 0) throw new Error("Hot cursor loads performed repository reads");

  const output = {
    scenario,
    node: process.versions.node,
    root: configuredRoot ? projectRoot : "synthetic-schema3",
    fixture: {
      schemaVersion: "3.0",
      ...(fixture.summary ?? {
        sourceRevisionFiles: Object.keys(pack.sourceRevision?.files ?? {}).length,
        currentRecords: pack.records.length,
        archiveGenerations: pack.archive?.generations?.length ?? 0,
        tombstones: pack.archive?.tombstones?.count ?? 0,
        runtimeDedupeExceptions: pack.dedupeExceptions?.length ?? 0
      }),
      records: pack.records.length,
      runtimeDedupeExceptions: scenario === "full"
        ? fixture.summary.runtimeDedupeExceptions
        : pack.dedupeExceptions.length,
      basePackValidated: true
    },
    samples: { cursor: sampleCount },
    coldIndexMs: Number(cold.milliseconds.toFixed(1)),
    p95Ms: { cursor: p95(cursorTimes, "Hot cursor load", 2_000) },
    repositoryReadsDuringHotQueries: cursorRepositoryReads,
    maxResponseBytes
  };

  if (scenario === "full") {
    const activeInput = { root: projectRoot, query: "active-performance-token" };
    const historyInput = {
      root: projectRoot,
      query: "history-performance-token",
      recordIds: [
        "record.history-performance-token-archived",
        "record.history-performance-token-tombstone"
      ],
      includeTombstones: true,
      limit: 50
    };
    const redundancyInput = { root: projectRoot, query: "redundancy-performance-token" };
    const activeWarm = await api.queryContext(activeInput);
    const historyWarm = await api.queryHistory(historyInput);
    const driftWarm = await api.detectDrift({ root: projectRoot });
    assertCanonicalActiveResult(activeWarm);
    assertCanonicalHistoryResult(historyWarm);
    const warmHistorySources = historySources(historyWarm);
    if (!warmHistorySources.has("archive") || !warmHistorySources.has("tombstone")) {
      throw new Error("Full performance history query must return archive and tombstone sources");
    }
    for (const result of [activeWarm, historyWarm, driftWarm]) {
      output.maxResponseBytes = Math.max(output.maxResponseBytes, assertBoundedResponse(result));
    }
    const activeTimes = [];
    const historyTimes = [];
    const driftTimes = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const active = await measured(() => api.queryContext(activeInput));
      const history = await measured(() => api.queryHistory(historyInput));
      const drift = await measured(() => api.detectDrift({ root: projectRoot }));
      assertCanonicalActiveResult(active.value);
      assertCanonicalHistoryResult(history.value);
      const timedHistorySources = historySources(history.value);
      if (!timedHistorySources.has("archive") || !timedHistorySources.has("tombstone")) {
        throw new Error("Timed history query did not preserve archive and tombstone retrieval");
      }
      activeTimes.push(active.milliseconds);
      historyTimes.push(history.milliseconds);
      driftTimes.push(drift.milliseconds);
      for (const result of [active.value, history.value, drift.value]) {
        output.maxResponseBytes = Math.max(output.maxResponseBytes, assertBoundedResponse(result));
      }
    }

    for (const document of fixture.expandedDocuments) {
      await writeFile(join(projectRoot, ...document.path.split("/")), document.content, "utf8");
    }
    const redundancyPack = fixture.redundancyPack;
    const manifestPath = join(projectRoot, "docs", "project-design", "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(redundancyPack, null, 2)}\n`, "utf8");
    const redundancyValidation = await api.validatePack({ root: projectRoot, pack: redundancyPack });
    if (redundancyValidation.valid !== true) {
      throw new Error(`Performance redundancy Schema 3.0 fixture is invalid: ${JSON.stringify(redundancyValidation.errors)}`);
    }
    representative = assertRepresentativeFullFixture(redundancyPack, false);
    redundancyPack.dedupeExceptions.push(fixture.staleException);
    await writeFile(manifestPath, `${JSON.stringify(redundancyPack, null, 2)}\n`, "utf8");
    representative = assertRepresentativeFullFixture(redundancyPack, true);
    const expectedRedundancyContentReads = Object.keys(redundancyPack.sourceRevision.files).length + 1;
    digestCounts = new Map();
    redundancyContentReads = 0;
    const redundancyWarm = await api.analyzeRedundancy(redundancyInput);
    assertRepresentativeRedundancyResult(redundancyWarm, representative);
    assertDigestPass(digestCounts, representative.redundancyRecordIds);
    if (redundancyContentReads !== expectedRedundancyContentReads) {
      throw new Error(`Redundancy read pass used ${redundancyContentReads} repository reads instead of ${expectedRedundancyContentReads}`);
    }
    output.maxResponseBytes = Math.max(output.maxResponseBytes, assertBoundedResponse(redundancyWarm));
    Object.assign(output.fixture, {
      exactExceptionCount: representative.exactExceptionCount,
      staleExceptionCount: representative.staleExceptionCount
    });
    output.phases = {
      canonical: {
        validated: true,
        currentRecords: pack.records.length,
        dedupeExceptions: pack.dedupeExceptions.length,
        timedOperations: ["active", "history", "drift"]
      },
      redundancyCanonical: {
        validated: true,
        currentRecords: redundancyPack.records.length,
        dedupeExceptions: 1
      },
      intentionalStaleException: {
        injectedOnlyAfterCanonicalQueries: true,
        dedupeExceptions: redundancyPack.dedupeExceptions.length,
        timedOperations: ["redundancy"]
      }
    };
    output.results = {
      activeRecords: activeWarm.records.length,
      historyItems: historyWarm.items.length,
      historySources: [...warmHistorySources].sort(),
      redundancyCandidates: redundancyWarm.candidates.length,
      invalidatedExceptionCount: redundancyWarm.invalidatedExceptionCount,
      digestedRecordsPerPass: digestCounts.size,
      repositoryContentReadsPerRedundancyPass: redundancyContentReads
    };
    const redundancyTimes = [];
    for (let index = 0; index < sampleCount; index += 1) {
      digestCounts = new Map();
      redundancyContentReads = 0;
      const redundancy = await measured(() => api.analyzeRedundancy(redundancyInput));
      assertDigestPass(digestCounts, representative.redundancyRecordIds);
      if (redundancyContentReads !== expectedRedundancyContentReads) {
        throw new Error("Timed redundancy query did not preserve bounded repository reads");
      }
      assertRepresentativeRedundancyResult(redundancy.value, representative);
      redundancyTimes.push(redundancy.milliseconds);
      output.maxResponseBytes = Math.max(output.maxResponseBytes, assertBoundedResponse(redundancy.value));
    }
    Object.assign(output.samples, {
      active: sampleCount,
      history: sampleCount,
      drift: sampleCount,
      redundancy: sampleCount
    });
    Object.assign(output.p95Ms, {
      active: p95(activeTimes, "Hot active query", 2_000),
      history: p95(historyTimes, "Hot history query", 3_000),
      drift: p95(driftTimes, "Hot drift query", 3_000),
      redundancy: p95(redundancyTimes, "Hot redundancy analysis", 3_000)
    });
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}
