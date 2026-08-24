import { createHash } from "node:crypto";
import { link, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { validateRedundancyDecisions } from "../src/knowledge/redundancy.js";
import { writeV3PackFixture } from "./canonical-pack-fixture.js";

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function hash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function record(id: string, statement: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "principle",
    ownerDocument: "document.principles",
    domain: "camera",
    scope: "spherical-rts",
    statement,
    evidence: [{ path: "Source/camera.cpp", startLine: 1, role: "implementation", excerptHash: hash("camera") }],
    impact: ["camera movement"],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    assertedConfidence: "medium",
    lifecycle: { state: "active" },
    ...overrides
  };
}

async function writeManifest(records: Record<string, unknown>[], dedupeExceptions: Record<string, unknown>[] = []): Promise<void> {
  const directory = join(project().repository, "docs", "project-design");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify({
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 1,
    scope: { root: ".", paths: ["Source/camera.cpp"] },
    sourceRevision: { kind: "git", files: { "Source/camera.cpp": hash("camera") } },
    documents: [],
    records,
    archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
    dedupeExceptions
  }, null, 2)}\n`, "utf8");
}

describe("semantic redundancy candidate analysis", () => {
  test("rejects an oversized manifest before parsing its full contents", async () => {
    await writeManifest([record("record.one", "bounded manifest")]);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
      { root: project().repository },
      { limits: { scan: { maxFileBytes: 128 } } }
    )).rejects.toThrow(/manifest|file.*bytes|byte.*limit|exceeds/i);
  });

  test("bounds aggregate bytes while hashing source revisions", async () => {
    await writeManifest([record("record.one", "bounded revision aggregate")]);
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const sourceRevision = manifest.sourceRevision as { files: Record<string, string> };
    sourceRevision.files = { "Source/a.cpp": hash("a"), "Source/b.cpp": hash("b") };
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await Promise.all([
      writeFile(join(project().repository, "Source", "a.cpp"), "a".repeat(100), "utf8"),
      writeFile(join(project().repository, "Source", "b.cpp"), "b".repeat(100), "utf8")
    ]);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const manifestBytes = (await readFile(manifestPath)).byteLength;

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
      { root: project().repository },
      { limits: { scan: { maxFileBytes: 1024 * 1024, maxAggregateBytes: manifestBytes + 150 } } }
    )).rejects.toThrow(/aggregate|byte.*limit|exceeds/i);
  });

  test("bounds the number of source revisions before opening them", async () => {
    await writeManifest([record("record.one", "bounded revision count")]);
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const sourceRevision = manifest.sourceRevision as { files: Record<string, string> };
    sourceRevision.files = { "Source/a.cpp": hash("a"), "Source/b.cpp": hash("b") };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
      { root: project().repository },
      { limits: { scan: { maxFiles: 1 } } }
    )).rejects.toThrow(/source|file.*limit|too many|exceeds/i);
  });

  test("rejects a source revision whose hard-link count changes before its handle stat", async () => {
    const left = record("record.link-left", "The camera follows the selected planet smoothly.", {
      evidence: [{ path: "Source/stale.cpp", startLine: 1, role: "implementation", excerptHash: hash("old") }]
    });
    const right = record("record.link-right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    const sourcePath = join(project().repository, "Source", "camera.cpp");
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.sourceRevision = {
      kind: "git",
      files: { "Source/stale.cpp": hash("old"), "Source/camera.cpp": hash("camera") }
    };
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await Promise.all([
      writeFile(join(project().repository, "Source", "stale.cpp"), "changed", "utf8"),
      writeFile(sourcePath, "camera", "utf8"),
      writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
    ]);
    let linked = false;

    const result = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
      { root: project().repository },
      {
        redundancyIo: {
          beforeRepositoryContentRead: async (path: string) => {
            if (path !== sourcePath || linked) return;
            await link(path, `${path}.hard-link`);
            linked = true;
          }
        }
      }
    );

    expect(linked).toBe(true);
    expect(result).toMatchObject({
      candidates: [expect.objectContaining({ recommendedSurvivorId: "record.link-left" })]
    });
  });

  test("bounds a repository content hook that never resolves by the shared read deadline", async () => {
    await writeManifest([record("record.deadline", "The redundancy reader honors its operation deadline.")]);
    let outerTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        (await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
          { root: project().repository },
          {
            limits: { scan: { deadlineMs: 10 } },
            redundancyIo: {
              beforeRepositoryContentRead: async () => await new Promise<void>(() => undefined)
            }
          }
        ).catch((failure: unknown) => failure),
        new Promise<Error>((accept) => {
          outerTimer = setTimeout(() => accept(new Error("outer test timeout")), 1_000);
        })
      ]);

      expect(outcome).toBeInstanceOf(Error);
      expect(String((outcome as Error).message)).toMatch(/redundancy|read|deadline|milliseconds exceeded/iu);
      expect(String((outcome as Error).message)).not.toMatch(/outer test timeout/iu);
    } finally {
      if (outerTimer) clearTimeout(outerTimer);
    }
  });

  test("rejects more than 10,000 raw records before normalization while accepting the exact boundary", async () => {
    await writeManifest(Array.from({ length: 10_000 }, () => null) as unknown as Record<string, unknown>[]);
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [] });

    await writeManifest(Array.from({ length: 10_001 }, () => null) as unknown as Record<string, unknown>[]);
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/10.?000|record.*limit|too many/i);
  });

  test("rejects missing or duplicate record IDs before candidate IDs can become ambiguous", async () => {
    await writeManifest([
      record("duplicate", "The camera follows the selected planet smoothly."),
      record("duplicate", "Selected planet camera movement follows smoothly.")
    ]);
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/record.*id|duplicate|unique/i);

    await writeManifest([record("", "A record without an identity")]);
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/record.*id|missing|empty/i);
  });

  test.each([
    {
      name: "evidence",
      overrides: { evidence: Array.from({ length: 129 }, () => "Source/camera.cpp:1") },
      expected: /record evidence.*128|evidence.*limit/i
    },
    {
      name: "impact",
      overrides: { impact: Array.from({ length: 129 }, (_, index) => `impact-${index}`) },
      expected: /record impact.*128|impact.*limit/i
    }
  ])("rejects a record above the per-record $name cardinality bound", async ({ name, overrides, expected }) => {
    await writeManifest([record(`record.${name}`, "bounded record fields", overrides)]);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(expected);
  });

  test("skips terminal records before charging active-record evidence bounds", async () => {
    await writeManifest([record("record.terminal", "retired duplicate", {
      lifecycle: {
        state: "terminal",
        reason: "resolved",
        sinceRevision: 1,
        confirmedRefreshes: 2,
        successorIds: []
      },
      evidence: Array.from({ length: 129 }, () => "Source/camera.cpp:1")
    })]);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [], invalidatedExceptionCount: 0 });
  });

  test("rejects a statement whose unique trigram index exceeds its per-record work bound", async () => {
    const uniqueStatement = Array.from({ length: 4_100 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join("");
    await writeManifest([record("record.trigram-bound", uniqueStatement)]);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/trigram bands.*4096|trigram.*limit/i);
  });

  test("marks malformed source-revision entries invalid without opening attacker paths", async () => {
    const left = record("record.invalid-source-left", "The camera follows the selected planet smoothly.");
    const right = record("record.invalid-source-right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.sourceRevision = {
      kind: "git",
      files: {
        "../outside.cpp": hash("outside"),
        "Source/non-string.cpp": 42
      }
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [expect.any(Object)], invalidatedExceptionCount: 0 });
  });

  test("ignores malformed dedupe exception entries without suppressing a real candidate", async () => {
    const left = record("record.invalid-exception-left", "The camera follows the selected planet smoothly.");
    const right = record("record.invalid-exception-right", "Selected planet camera movement follows smoothly.");
    const malformed = [
      null,
      "not-an-object",
      { leftId: 7, rightId: right.id },
      { leftId: left.id, rightId: right.id }
    ] as unknown as Record<string, unknown>[];
    await writeManifest([left, right], malformed);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [expect.any(Object)], invalidatedExceptionCount: 1 });
  });

  test("rejects dedupe exceptions above the bounded pair inventory", async () => {
    await writeManifest(
      [record("record.exception-limit", "bounded exception inventory")],
      Array.from({ length: 20_001 }, (_, index) => ({
        leftId: `record.left.${index}`,
        rightId: `record.right.${index}`
      }))
    );

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/exceptions.*20.?000|exception.*limit|narrow.*scope/i);
  });

  test("treats a non-object source revision file map as an empty freshness snapshot", async () => {
    const left = record("record.no-revision-left", "The camera follows the selected planet smoothly.");
    const right = record("record.no-revision-right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.sourceRevision = { kind: "git", files: null };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [expect.any(Object)], invalidatedExceptionCount: 0 });
  });

  test("allows exactly 20,000 unique bucket pairs and fails before pair 20,001 without truncation", async () => {
    const boundaryRecords = (includeOverflowPair: boolean) => {
      const groups = [200, 10, 10, 5, ...(includeOverflowPair ? [2] : [])];
      let ordinal = 0;
      return groups.flatMap((count, group) => Array.from({ length: count }, () => {
        const current = ordinal++;
        const unique = String.fromCodePoint(0x4e00 + current);
        const prefix = String.fromCharCode(97 + group).repeat(3);
        return record(`record.boundary.${current}`, `${prefix}${unique.repeat(64)}`, {
          impact: [`impact-${current}`],
          evidence: [{
            path: `Source/boundary-${current}.cpp`, startLine: 1, role: "implementation", excerptHash: hash(String(current))
          }]
        });
      }));
    };

    await writeManifest(boundaryRecords(false));
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [] });

    await writeManifest(boundaryRecords(true));
    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .rejects.toThrow(/20.?000|pair.*limit|too many/i);
  });

  test("indexes the maximum exception set once instead of rescanning it for every shared-bucket pair", async () => {
    const records = Array.from({ length: 200 }, (_, index) => {
      const unique = String.fromCodePoint(0x4e00 + index);
      return record(`record.exception-work.${index}`, `aaa${unique.repeat(64)}`, {
        impact: [`impact-${index}`],
        evidence: [{
          path: `Source/exception-work-${index}.cpp`, startLine: 1, role: "implementation", excerptHash: hash(String(index))
        }]
      });
    });
    const exceptions = Array.from({ length: 20_000 }, (_, index) => ({
      leftId: `unrelated-left-${index}`,
      rightId: `unrelated-right-${index}`
    }));
    await writeManifest(records, exceptions);

    await expect((await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository }))
      .resolves.toMatchObject({ candidates: [] });
  }, 5_000);

  test("hashes each record once when one candidate pair has many stale exceptions", async () => {
    const left = record("record.digest-left", "The camera follows the selected planet smoothly.");
    const right = record("record.digest-right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right], Array.from({ length: 64 }, (_, index) => ({
      leftId: left.id,
      rightId: right.id,
      leftDigest: hash(`stale-left-${index}`),
      rightDigest: hash(`stale-right-${index}`)
    })));
    const digestCounts = new Map<string, number>();

    const result = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy(
      { root: project().repository },
      { redundancyIo: { onRecordDigest: (id) => digestCounts.set(id, (digestCounts.get(id) ?? 0) + 1) } }
    );

    expect(result).toMatchObject({ invalidatedExceptionCount: 1, candidates: [expect.any(Object)] });
    expect(Object.fromEntries(digestCounts)).toEqual({ "record.digest-left": 1, "record.digest-right": 1 });
  });

  test("derives one deterministic candidate ID independent of manifest record order", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.");
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    const module = await import("../src/knowledge/redundancy.js");
    const first = await module.analyzeRedundancy({ root: project().repository });
    await writeManifest([right, left]);
    const second = await module.analyzeRedundancy({ root: project().repository });

    expect((first.candidates as Array<Record<string, unknown>>)).toHaveLength(1);
    expect((second.candidates as Array<Record<string, unknown>>)).toHaveLength(1);
    expect((first.candidates as Array<Record<string, unknown>>)[0]!.candidateId)
      .toBe((second.candidates as Array<Record<string, unknown>>)[0]!.candidateId);
  });

  test("uses collision-free order-independent pair IDs for arbitrary unique record IDs", async () => {
    const pairRecord = (id: string, statement: string, group: string) => record(id, statement, {
      impact: [`impact-${group}`],
      evidence: [{ path: `Source/${group}.cpp`, startLine: 1, role: "implementation", excerptHash: hash(group) }]
    });
    await writeManifest([
      pairRecord("a\0b", "aaaaaaaaaaaaaaaa", "nul-one"),
      pairRecord("c", "aaaaaaaaaaaaaaaa", "nul-one"),
      pairRecord("a", "zzzzzzzzzzzzzzzz", "nul-two"),
      pairRecord("b\0c", "zzzzzzzzzzzzzzzz", "nul-two")
    ]);
    const module = await import("../src/knowledge/redundancy.js");
    const collisionResult = await module.analyzeRedundancy({ root: project().repository });
    const collisionIds = (collisionResult.candidates as Array<Record<string, unknown>>).map((candidate) => candidate.candidateId);
    expect(collisionIds).toHaveLength(2);
    expect(new Set(collisionIds).size).toBe(2);

    const composed = pairRecord("é", "mmmmmmmmmmmmmmmm", "unicode");
    const decomposed = pairRecord("e\u0301", "mmmmmmmmmmmmmmmm", "unicode");
    await writeManifest([composed, decomposed]);
    const forward = await module.analyzeRedundancy({ root: project().repository });
    await writeManifest([decomposed, composed]);
    const reverse = await module.analyzeRedundancy({ root: project().repository });
    expect((forward.candidates as Array<Record<string, unknown>>)[0]!.candidateId)
      .toBe((reverse.candidates as Array<Record<string, unknown>>)[0]!.candidateId);
  });

  test("recalls impact-related legacy records when structural fields are absent", async () => {
    await writeManifest([
      record("record.legacy-left", "aaaaaaaaaaaaaaaa", {
        kind: undefined,
        ownerDocument: undefined,
        scope: undefined,
        impact: ["shared consequence"],
        evidence: [{ path: "Source/legacy-left.cpp", startLine: 1, role: "implementation", excerptHash: hash("left") }]
      }),
      record("record.legacy-right", "zzzzzzzzzzzzzzzz", {
        kind: undefined,
        ownerDocument: undefined,
        scope: undefined,
        impact: ["shared consequence"],
        evidence: [{ path: "Source/legacy-right.cpp", startLine: 1, role: "implementation", excerptHash: hash("right") }]
      })
    ]);

    const result = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository });

    expect(result).toMatchObject({
      candidates: [expect.objectContaining({
        recordIds: ["record.legacy-left", "record.legacy-right"],
        reasons: expect.arrayContaining(["impact-overlap", "same-kind", "same-scope", "same-owner"])
      })]
    });
  });

  test("recalls a deterministic candidate and recommends the confirmed normative survivor", async () => {
    await writeManifest([
      record("record.older", "The camera follows the selected planet smoothly.", {
        strength: "preferred", approval: "confirmed", assertedConfidence: "high"
      }),
      record("record.newer", "Selected planet camera movement follows smoothly."),
      record("record.other", "Units use server authoritative movement.", {
        domain: "network",
        scope: "networking",
        impact: ["authority"],
        evidence: [{ path: "Source/network.cpp", startLine: 1, role: "implementation", excerptHash: hash("network") }]
      })
    ]);
    const api = (await import("../src/index.js")).projectDesignKeeper as unknown as {
      analyzeRedundancy(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    };

    const result = await api.analyzeRedundancy({ root: project().repository });

    expect(result).toMatchObject({
      analysisId: expect.any(String),
      expiresAt: expect.any(String),
      candidates: [{
        candidateId: expect.any(String),
        recordIds: ["record.older", "record.newer"],
        recommendedSurvivorId: "record.older",
        reasons: expect.arrayContaining([expect.stringMatching(/trigram|impact|scope/i)]),
        decision: null
      }]
    });
  });

  test("prefers the candidate with fresh evidence when effective confidence is tied", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.", {
      evidence: [{ path: "Source/stale.cpp", startLine: 1, role: "implementation", excerptHash: hash("old") }]
    });
    const right = record("record.right", "Selected planet camera movement follows smoothly.", {
      evidence: [{ path: "Source/fresh.cpp", startLine: 1, role: "implementation", excerptHash: hash("fresh") }]
    });
    await writeManifest([left, right]);
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.sourceRevision = {
      kind: "git",
      files: { "Source/stale.cpp": hash("old"), "Source/fresh.cpp": hash("fresh") }
    };
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(join(project().repository, "Source", "stale.cpp"), "changed", "utf8");
    await writeFile(join(project().repository, "Source", "fresh.cpp"), "fresh", "utf8");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository });
    expect(result).toMatchObject({
      candidates: [expect.objectContaining({ recommendedSurvivorId: "record.right" })]
    });
  });

  test("suppresses a rejected pair only while both content digests remain unchanged", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.");
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    const digest = (value: Record<string, unknown>) => hash(JSON.stringify(value));
    await writeManifest([left, right], [{
      leftId: "record.left",
      rightId: "record.right",
      leftDigest: digest(left),
      rightDigest: digest(right)
    }]);
    const api = (await import("../src/index.js")).projectDesignKeeper as unknown as {
      analyzeRedundancy(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    };

    expect(await api.analyzeRedundancy({ root: project().repository })).toMatchObject({ candidates: [] });

    right.statement = "Selected planet camera movement follows smoothly with collision avoidance.";
    await writeManifest([left, right], [{
      leftId: "record.left",
      rightId: "record.right",
      leftDigest: digest(left),
      rightDigest: hash("obsolete")
    }]);
    const changed = await api.analyzeRedundancy({ root: project().repository });
    expect(changed).toMatchObject({
      candidates: [expect.objectContaining({ recordIds: ["record.left", "record.right"] })],
      invalidatedExceptionCount: 1
    });
  });

  test("binds confirmed decisions to an untampered, unexpired knowledge snapshot", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.");
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    const digest = (value: Record<string, unknown>) => hash(JSON.stringify(value));
    await writeManifest([left, right]);
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(join(project().repository, "Source", "camera.cpp"), "camera", "utf8");
    const module = await import("../src/knowledge/redundancy.js");
    const analyzed = await module.analyzeRedundancy({ root: project().repository }, { now: () => 1_000 });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>)[0];
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const candidatePack = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    candidatePack.dedupeExceptions = [{
      leftId: "record.left",
      rightId: "record.right",
      leftDigest: digest(left),
      rightDigest: digest(right)
    }];
    const decision = [{ candidateId: String(candidate.candidateId), decision: "keep-separate" as const }];

    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: decision,
      candidatePack,
      now: () => 2_000
    })).resolves.toBeUndefined();
    candidatePack.dedupeExceptions = [{
      leftId: "record.right",
      rightId: "record.left",
      leftDigest: digest(right),
      rightDigest: digest(left)
    }];
    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: decision,
      candidatePack,
      now: () => 2_000
    })).resolves.toBeUndefined();
    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: `${String(analyzed.analysisId)}x`,
      decisions: decision,
      candidatePack,
      now: () => 2_000
    })).rejects.toThrow(/tampered/i);
    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: decision,
      candidatePack,
      now: () => 1_000 + 31 * 60 * 1_000
    })).rejects.toThrow(/expired/i);

    await writeFile(join(project().repository, "Source", "camera.cpp"), "changed after analysis", "utf8");
    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: decision,
      candidatePack,
      now: () => 2_000
    })).rejects.toThrow(/stale/i);
    await writeFile(join(project().repository, "Source", "camera.cpp"), "camera", "utf8");

    await writeManifest([left, { ...right, statement: "Changed after analysis" }]);
    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: decision,
      candidatePack,
      now: () => 2_000
    })).rejects.toThrow(/stale/i);
  });

  test("rejects a merge that promotes the survivor's normative strength or confidence", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.");
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    const analyzed = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>)[0];
    const candidatePack = JSON.parse(await readFile(join(project().repository, "docs/project-design/manifest.json"), "utf8")) as {
      records: Array<Record<string, unknown>>;
    } & Record<string, unknown>;
    const survivorId = String(candidate.recommendedSurvivorId);
    const loserId = (candidate.recordIds as string[]).find((id) => id !== survivorId)!;
    const survivor = candidatePack.records.find((value) => value.id === survivorId)!;
    survivor.strength = "preferred";
    survivor.approval = "confirmed";
    survivor.assertedConfidence = "high";
    const loser = candidatePack.records.find((value) => value.id === loserId)!;
    loser.lifecycle = {
      state: "terminal",
      reason: "merged",
      sinceRevision: 2,
      confirmedRefreshes: 1,
      successorIds: [survivorId]
    };

    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: [{ candidateId: String(candidate.candidateId), decision: "merge", survivorId }],
      candidatePack
    })).rejects.toThrow(/promot|strength|confidence|approval/i);
  });

  test("rejects a merge that promotes effective confidence by adding stronger evidence", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.", { assertedConfidence: "high" });
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(join(project().repository, "Source", "camera.cpp"), "camera", "utf8");
    const analyzed = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>)[0];
    const candidatePack = JSON.parse(await readFile(join(project().repository, "docs/project-design/manifest.json"), "utf8")) as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const survivorId = String(candidate.recommendedSurvivorId);
    const loserId = (candidate.recordIds as string[]).find((id) => id !== survivorId)!;
    const survivor = candidatePack.records.find((value) => value.id === survivorId)!;
    survivor.evidence = [...(survivor.evidence as unknown[]), {
      path: "Source/camera.cpp", startLine: 1, role: "design", excerptHash: hash("camera")
    }];
    const loser = candidatePack.records.find((value) => value.id === loserId)!;
    loser.lifecycle = { state: "terminal", reason: "merged", sinceRevision: 2, confirmedRefreshes: 1, successorIds: [survivorId] };

    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: [{ candidateId: String(candidate.candidateId), decision: "merge", survivorId }],
      candidatePack
    })).rejects.toThrow(/effective confidence|promot/i);
  });

  test("rejects effective-confidence promotion through a newly declared fresh evidence source", async () => {
    const left = record("record.left", "The camera follows the selected planet smoothly.", {
      kind: "architecture",
      ownerDocument: "document.architecture",
      strength: "required",
      approval: "confirmed",
      assertedConfidence: "high",
      evidence: [{ path: "Source/camera.cpp", startLine: 1, role: "design", excerptHash: hash("camera") }]
    });
    const right = record("record.right", "Selected planet camera movement follows smoothly.");
    await writeManifest([left, right]);
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(join(project().repository, "Source", "camera.cpp"), "camera", "utf8");
    await writeFile(join(project().repository, "Source", "new.cpp"), "implementation", "utf8");
    const analyzed = await (await import("../src/knowledge/redundancy.js")).analyzeRedundancy({ root: project().repository });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>)[0];
    const candidatePack = JSON.parse(await readFile(join(project().repository, "docs/project-design/manifest.json"), "utf8")) as {
      records: Array<Record<string, unknown>>;
      sourceRevision: { files: Record<string, string> };
    } & Record<string, unknown>;
    candidatePack.sourceRevision.files["Source/new.cpp"] = hash("implementation");
    const survivorId = String(candidate.recommendedSurvivorId);
    const loserId = (candidate.recordIds as string[]).find((id) => id !== survivorId)!;
    const survivor = candidatePack.records.find((value) => value.id === survivorId)!;
    survivor.evidence = [...(survivor.evidence as unknown[]), {
      path: "Source/new.cpp", startLine: 1, role: "implementation", excerptHash: hash("implementation")
    }];
    const loser = candidatePack.records.find((value) => value.id === loserId)!;
    loser.lifecycle = { state: "terminal", reason: "merged", sinceRevision: 2, confirmedRefreshes: 1, successorIds: [survivorId] };

    await expect(validateRedundancyDecisions({
      root: project().repository,
      analysisId: String(analyzed.analysisId),
      decisions: [{ candidateId: String(candidate.candidateId), decision: "merge", survivorId }],
      candidatePack
    })).rejects.toThrow(/effective confidence|promot/i);
  });

  test("previewUpdate accepts only snapshot-bound decisions encoded in the candidate pack", async () => {
    const pack = await writeV3PackFixture(project()) as { maintenanceRevision: number; records: Array<Record<string, unknown>>; dedupeExceptions: Array<Record<string, unknown>> } & Record<string, unknown>;
    const original = pack.records.find((value) => value.id === "record.architecture")!;
    const duplicate = {
      ...original,
      id: "record.architecture.duplicate",
      statement: "The project keeps one atomic architecture record."
    };
    pack.records.push(duplicate);
    const architecturePath = join(project().repository, "docs", "project-design", "architecture.md");
    const duplicateBody = "Duplicate architecture record\n";
    await writeFile(
      architecturePath,
      `${await readFile(architecturePath, "utf8")}<!-- project-design-keeper:managed record-id="record.architecture.duplicate" content-hash="${hash(duplicateBody)}" -->${duplicateBody}<!-- /project-design-keeper:managed -->`,
      "utf8"
    );
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    const api = (await import("../src/index.js")).createProjectDesignKeeper({ cacheDirectory: join(project().root, "keeper-cache") });
    const analyzed = await api.analyzeRedundancy({ root: project().repository });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>).find((value) =>
      (value.recordIds as string[]).includes("record.architecture.duplicate")
    )!;
    const candidatePack = {
      ...pack,
      maintenanceRevision: pack.maintenanceRevision + 1,
      dedupeExceptions: [{
        leftId: (candidate.recordIds as string[])[0],
        rightId: (candidate.recordIds as string[])[1],
        leftDigest: hash(JSON.stringify(pack.records.find((value) => value.id === (candidate.recordIds as string[])[0]))),
        rightDigest: hash(JSON.stringify(pack.records.find((value) => value.id === (candidate.recordIds as string[])[1])))
      }]
    };
    const changes = [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }];
    const decisions = [{ candidateId: String(candidate.candidateId), decision: "keep-separate" }];

    await expect(api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes,
      analysisId: analyzed.analysisId,
      redundancyDecisions: decisions
    })).resolves.toMatchObject({ applicable: true, validation: { valid: true } });
    await expect(api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes,
      analysisId: `${String(analyzed.analysisId)}x`,
      redundancyDecisions: decisions
    })).rejects.toThrow(/tampered/i);
  });

  test("previewUpdate evaluates merge confidence against the candidate file overlay", async () => {
    const pack = await writeV3PackFixture(project()) as {
      maintenanceRevision: number;
      records: Array<Record<string, unknown>>;
      sourceRevision: { files: Record<string, string> };
    } & Record<string, unknown>;
    const original = pack.records.find((value) => value.id === "record.architecture")!;
    original.evidence = (original.evidence as Array<Record<string, unknown>>).map((evidence) => ({ ...evidence, role: "design" }));
    original.strength = "required";
    original.approval = "confirmed";
    original.assertedConfidence = "high";
    const duplicate = { ...structuredClone(original), id: "record.architecture.duplicate", statement: "The project keeps its one atomic architecture record." };
    pack.records.push(duplicate);
    const architecturePath = join(project().repository, "docs/project-design/architecture.md");
    const duplicateBody = "Duplicate architecture record\n";
    await writeFile(
      architecturePath,
      `${await readFile(architecturePath, "utf8")}<!-- project-design-keeper:managed record-id="record.architecture.duplicate" content-hash="${hash(duplicateBody)}" -->${duplicateBody}<!-- /project-design-keeper:managed -->`,
      "utf8"
    );
    const manifestPath = join(project().repository, "docs/project-design/manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    const api = (await import("../src/index.js")).createProjectDesignKeeper({ cacheDirectory: join(project().root, "keeper-cache-overlay") });
    const analyzed = await api.analyzeRedundancy({ root: project().repository });
    const candidate = (analyzed.candidates as Array<Record<string, unknown>>).find((value) =>
      (value.recordIds as string[]).includes("record.architecture.duplicate")
    )!;
    const candidatePack = structuredClone(pack);
    candidatePack.maintenanceRevision += 1;
    const survivorId = String(candidate.recommendedSurvivorId);
    const loserId = (candidate.recordIds as string[]).find((id) => id !== survivorId)!;
    const survivor = candidatePack.records.find((value) => value.id === survivorId)!;
    const loser = candidatePack.records.find((value) => value.id === loserId)!;
    loser.lifecycle = { state: "terminal", reason: "merged", sinceRevision: 2, confirmedRefreshes: 1, successorIds: [survivorId] };

    const verificationPath = "docs/project-design/verification.md";
    const verificationFile = join(project().repository, ...verificationPath.split("/"));
    const newBody = "New implementation evidence\n";
    const currentVerification = await readFile(verificationFile, "utf8");
    const finalVerification = currentVerification.replace(
      /<!-- project-design-keeper:managed record-id="record\.verification" content-hash="sha256:[a-f0-9]{64}" -->[\s\S]*?<!-- \/project-design-keeper:managed -->/u,
      `<!-- project-design-keeper:managed record-id="record.verification" content-hash="${hash(newBody)}" -->${newBody}<!-- /project-design-keeper:managed -->`
    );
    const evidenceLine = finalVerification.split(/\r?\n/u).findIndex((line) => line.includes("New implementation evidence")) + 1;
    const excerpt = finalVerification.split(/\r?\n/u)[evidenceLine - 1];
    candidatePack.sourceRevision.files[verificationPath] = hash(finalVerification);
    survivor.evidence = [...(survivor.evidence as unknown[]), {
      path: verificationPath,
      startLine: evidenceLine,
      role: "implementation",
      excerptHash: hash(excerpt)
    }];

    await expect(api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes: [
        { path: verificationPath, managedBlock: { recordId: "record.verification", content: newBody } },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }
      ],
      analysisId: analyzed.analysisId,
      redundancyDecisions: [{ candidateId: String(candidate.candidateId), decision: "merge", survivorId }]
    })).rejects.toThrow(/effective confidence|promot/i);
  });
});
