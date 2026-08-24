import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { ByteBudget, CounterBudget, DeadlineBudget } from "../src/security/limits.js";
import { validatePack } from "../src/types/schema.js";
import { writeCanonicalPackFixture, writeV3PackFixture } from "./canonical-pack-fixture.js";
import {
  createProjectFixture,
  removeProjectFixture,
  type ProjectFixture
} from "./fixtures.js";

type MutableObject = Record<string, any>;

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("project fixture was not created");
  return fixture;
}

function hash(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function validationOptions(value: Record<string, unknown>): Parameters<typeof validatePack>[1] {
  return value as unknown as Parameters<typeof validatePack>[1];
}

function sourcePath(): string {
  return relative(project().repository, project().trackedText).replaceAll("\\", "/");
}

async function v3Pack(): Promise<MutableObject> {
  return await writeV3PackFixture(project()) as MutableObject;
}

async function v1Pack(): Promise<MutableObject> {
  return await writeCanonicalPackFixture(project()) as MutableObject;
}

describe("bounded public pack validation", () => {
  test("binds service scan limits to the public Keeper validation method", async () => {
    const pack = await v3Pack();
    await appendFile(
      join(project().repository, "docs", "project-design", "intent.md"),
      `\n${"x".repeat(2_048)}`,
      "utf8"
    );
    const api = createProjectDesignKeeper({ limits: { scan: { maxFileBytes: 1_024 } } });

    await expect(api.validatePack({ root: project().repository, pack }))
      .rejects.toThrow(/pack validation file.*1[ ,]?024 bytes/i);
  });

  test("binds service validation identity hooks to the public Keeper validation method", async () => {
    const pack = await v3Pack();
    let hookCalls = 0;
    const replacement = "Keeper evidence: sun--garden\n";
    const api = createProjectDesignKeeper({
      validationIo: {
        afterProjectFileOpen: async (path: string) => {
          if (path !== sourcePath() || hookCalls > 0) return;
          hookCalls += 1;
          await writeFile(project().trackedText, replacement, "utf8");
        }
      }
    });

    await expect(api.validatePack({ root: project().repository, pack }))
      .rejects.toThrow(/pack validation file.*identity.*changed/i);
    expect(hookCalls).toBe(1);
  });

  test("rejects terminal successor fan-out before schema graph validation", async () => {
    const pack = await v3Pack();
    const records = pack.records as MutableObject[];
    records[0].lifecycle = {
      state: "terminal",
      reason: "superseded",
      sinceRevision: 1,
      confirmedRefreshes: 2,
      successorIds: Array.from({ length: records.length + 1 }, () => records[1].id)
    };
    const api = createProjectDesignKeeper({ limits: { pack: { maxRecords: records.length } } });

    await expect(api.validatePack({ root: project().repository, pack }))
      .rejects.toThrow(new RegExp(`pack record successors.*${records.length} items`, "i"));
  });

  test("bounds passthrough pack data before schema parsing", async () => {
    const pack = await v3Pack();
    const baselineBytes = Buffer.byteLength(JSON.stringify(pack), "utf8");
    pack.untrustedExtension = "x".repeat(1_024);
    const maximumBytes = baselineBytes + 128;
    const api = createProjectDesignKeeper({ limits: { mcpArgumentBytes: maximumBytes } });

    await expect(api.validatePack({ root: project().repository, pack }))
      .rejects.toThrow(new RegExp(`pack validation input.*${maximumBytes} bytes`, "i"));
  });

  test("accepts repeated JSON object references that are not circular", async () => {
    const pack = await v3Pack();
    const sharedExtension = { provenance: "one JSON value serialized at two locations" };
    pack.firstExtension = sharedExtension;
    pack.secondExtension = sharedExtension;

    await expect(createProjectDesignKeeper().validatePack({ root: project().repository, pack }))
      .resolves.toMatchObject({ valid: true, errors: [] });
  });

  test.each(["supersededBy", "successorIds"] as const)(
    "reports an unknown %s reference instead of misclassifying it as a cycle",
    async (kind) => {
      const pack = await v3Pack();
      const record = (pack.records as MutableObject[])[0];
      if (kind === "supersededBy") {
        record.supersededBy = "record.missing";
      } else {
        record.lifecycle = {
          state: "terminal",
          reason: "superseded",
          sinceRevision: 1,
          confirmedRefreshes: 2,
          successorIds: ["record.missing"]
        };
      }

      const result = await createProjectDesignKeeper().validatePack({ root: project().repository, pack }) as {
        errors: Array<{ message: string }>;
      };
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: "unknown supersession record: record.missing" })
      ]));
    }
  );

  test("does not let a shared resource budget widen the local aggregate hard limit", async () => {
    const pack = await v3Pack();
    const localAggregateBytes = 64 * 1_024;
    const overlay = new Map<string, Buffer | undefined>([
      ["docs/project-design/large-candidate.bin", Buffer.alloc(128 * 1_024)]
    ]);

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        overlay,
        limits: { scan: { maxFileBytes: 256 * 1_024, maxAggregateBytes: localAggregateBytes } },
        resourceBudget: {
          maxFileBytes: 1024 * 1024 * 1024,
          files: new CounterBudget("External validation files", 1_000_000),
          bytes: new ByteBudget("External validation bytes", 1024 * 1024 * 1024),
          deadline: new DeadlineBudget("External validation", 120_000)
        }
      })
    )).rejects.toThrow(new RegExp(`pack validation aggregate bytes.*${localAggregateBytes} bytes`, "i"));
  });

  test("does not let a shared resource budget widen the local deadline", async () => {
    const pack = await v3Pack();

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        limits: { scan: { deadlineMs: 0 } },
        resourceBudget: {
          maxFileBytes: 1024 * 1024 * 1024,
          files: new CounterBudget("External validation files", 1_000_000),
          bytes: new ByteBudget("External validation bytes", 1024 * 1024 * 1024),
          deadline: new DeadlineBudget("External validation", 120_000)
        }
      })
    )).rejects.toThrow(/pack validation.*deadline.*0 milliseconds/i);
  });

  test.each(["document", "source", "archive"] as const)(
    "rejects an oversized declared %s before allocating or parsing it",
    async (kind) => {
      const pack = await v3Pack();
      if (kind === "document") {
        await appendFile(
          join(project().repository, "docs", "project-design", "intent.md"),
          `\n${"x".repeat(2_048)}`,
          "utf8"
        );
      } else if (kind === "source") {
        const contents = `evidence line\n${"x".repeat(2_048)}`;
        await writeFile(project().trackedText, contents, "utf8");
        pack.sourceRevision.files[sourcePath()] = hash(contents);
        for (const record of pack.records as MutableObject[]) {
          for (const evidence of record.evidence as MutableObject[]) {
            evidence.excerptHash = hash("evidence line");
          }
        }
      } else {
        const archivePath = "docs/project-design/archive/generation-000001.records.jsonl";
        await mkdir(join(project().repository, "docs", "project-design", "archive"), { recursive: true });
        await writeFile(join(project().repository, ...archivePath.split("/")), "x".repeat(2_048), "utf8");
        pack.archive.generations = [{
          id: "generation-000001",
          path: archivePath,
          recordCount: 0,
          createdAt: "2026-08-18T00:00:00.000Z"
        }];
      }

      await expect(validatePack(
        { root: project().repository, pack },
        validationOptions({ limits: { scan: { maxFileBytes: 1_024 } } })
      )).rejects.toThrow(/pack validation file.*1[ ,]?024 bytes/i);
    }
  );

  test("shares one aggregate byte budget across every unique declared file", async () => {
    const pack = await v3Pack();

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        limits: { scan: { maxFileBytes: 4_096, maxAggregateBytes: 1_024 } }
      })
    )).rejects.toThrow(/pack validation aggregate bytes.*1[ ,]?024 bytes/i);
  });

  test("bounds managed-tree entry enumeration before reading declared files", async () => {
    const pack = await v3Pack();
    const managedRoot = join(project().repository, "docs", "project-design");
    await Promise.all(Array.from({ length: 4 }, (_unused, index) =>
      writeFile(join(managedRoot, `extra-${index}.txt`), "unmanaged\n", "utf8")));

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({ limits: { scan: { maxFiles: 10 } } })
    )).rejects.toThrow(/pack validation managed-tree entries.*10 items/i);
  });

  test("rejects a managed tree deeper than sixteen levels", async () => {
    const pack = await v3Pack();
    const nested = Array.from({ length: 17 }, (_unused, index) => `nested-${index}`);
    await mkdir(join(project().repository, "docs", "project-design", ...nested), { recursive: true });

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({})
    )).rejects.toThrow(/pack validation managed-tree depth.*16 levels/i);
  });

  test("shares structural, line, and relocation work in one operation budget", async () => {
    const pack = await v3Pack();
    const lines = Array.from({ length: 100 }, (_unused, index) => `line ${index + 1}`);
    const contents = `${lines.join("\n")}\n`;
    await writeFile(project().trackedText, contents, "utf8");
    pack.sourceRevision.files[sourcePath()] = hash(contents);
    const evidence = {
      path: sourcePath(),
      startLine: 1,
      role: "implementation",
      excerptHash: hash(lines[0])
    };
    for (const record of pack.records) record.evidence = [{ ...evidence }];
    let sourceIdentityChecks = 0;
    const options = () => validationOptions({
      limits: { scan: { maxEvidence: 500 } },
      io: {
        beforeProjectFileFinalIdentityCheck: async (path: string) => {
          if (path === sourcePath()) sourceIdentityChecks += 1;
        }
      }
    });

    await expect(validatePack(
      { root: project().repository, pack },
      options()
    )).resolves.toMatchObject({ valid: true });

    pack.records[0].evidence = [{ ...evidence, excerptHash: `sha256:${"0".repeat(64)}` }];
    await expect(validatePack(
      { root: project().repository, pack },
      options()
    )).rejects.toThrow(/pack validation work.*500 items/i);
    expect(sourceIdentityChecks).toBe(2);
  });

  test("checks the monotonic deadline before repository validation work", async () => {
    const pack = await v3Pack();

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({ limits: { scan: { deadlineMs: 0 } } })
    )).rejects.toThrow(/pack validation.*deadline.*0 milliseconds/i);
  });

  test("rejects a same-inode source rewrite while its bounded handle is open", async () => {
    const pack = await v3Pack();
    let hookCalls = 0;
    const original = "Keeper evidence: moon-garden\n";
    const replacement = "Keeper evidence: sun--garden\n";
    expect(Buffer.byteLength(replacement)).toBe(Buffer.byteLength(original));

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async (path: string) => {
            if (path !== sourcePath() || hookCalls > 0) return;
            hookCalls += 1;
            await writeFile(project().trackedText, replacement, "utf8");
          }
        }
      })
    )).rejects.toThrow(/pack validation file.*identity.*changed/i);
    expect(hookCalls).toBe(1);
  });

  test.each(["document", "source", "archive"] as const)(
    "revalidates an earlier %s file after later validation work",
    async (kind) => {
      const pack = await v3Pack();
      let earlierPath: string;
      let laterPath: string;
      if (kind === "document") {
        earlierPath = pack.documents[0].path;
        laterPath = pack.documents[1].path;
      } else if (kind === "source") {
        earlierPath = sourcePath();
        laterPath = "docs/project-design/archive/generation-000001.records.jsonl";
        await mkdir(join(project().repository, "docs", "project-design", "archive"), { recursive: true });
        await writeFile(join(project().repository, ...laterPath.split("/")), "", "utf8");
        pack.archive.generations = [{
          id: "generation-000001",
          path: laterPath,
          recordCount: 0,
          createdAt: "2026-08-18T00:00:00.000Z"
        }];
      } else {
        earlierPath = "docs/project-design/archive/generation-000001.records.jsonl";
        laterPath = "docs/project-design/archive/generation-000002.records.jsonl";
        await mkdir(join(project().repository, "docs", "project-design", "archive"), { recursive: true });
        await writeFile(join(project().repository, ...earlierPath.split("/")), "", "utf8");
        await writeFile(join(project().repository, ...laterPath.split("/")), "", "utf8");
        pack.archive.generations = [
          {
            id: "generation-000001",
            path: earlierPath,
            recordCount: 0,
            createdAt: "2026-08-17T00:00:00.000Z"
          },
          {
            id: "generation-000002",
            path: laterPath,
            recordCount: 0,
            createdAt: "2026-08-18T00:00:00.000Z"
          }
        ];
      }
      let mutations = 0;

      await expect(validatePack(
        { root: project().repository, pack },
        validationOptions({
          io: {
            afterProjectFileOpen: async (path: string) => {
              if (path !== laterPath || mutations > 0) return;
              mutations += 1;
              await appendFile(join(project().repository, ...earlierPath.split("/")), "late mutation", "utf8");
            }
          }
        })
      )).rejects.toThrow(/pack validation (?:managed-tree )?file.*identity.*changed/i);
      expect(mutations).toBe(1);
    }
  );

  test("revalidates the managed-tree inventory after document validation", async () => {
    const pack = await v3Pack();
    const triggerPath = pack.documents[0].path;
    let mutations = 0;

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async (path: string) => {
            if (path !== triggerPath || mutations > 0) return;
            mutations += 1;
            await writeFile(
              join(project().repository, "docs", "project-design", "late-unmapped.md"),
              "# appeared after inventory\n",
              "utf8"
            );
          }
        }
      })
    )).rejects.toThrow(/pack validation managed-tree.*identity.*changed/i);
    expect(mutations).toBe(1);
  });

  test("revalidates an earlier Markdown link target after later document work", async () => {
    const pack = await v3Pack();
    const firstDocument = pack.documents[0].path;
    const laterDocument = pack.documents[1].path;
    const linkedPath = join(project().repository, "linked-dependency.txt");
    await writeFile(linkedPath, "stable dependency\n", "utf8");
    await appendFile(
      join(project().repository, ...firstDocument.split("/")),
      "\n[dependency](../../linked-dependency.txt)\n",
      "utf8"
    );
    let mutations = 0;

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async (path: string) => {
            if (path !== laterDocument || mutations > 0) return;
            mutations += 1;
            await appendFile(linkedPath, "late mutation\n", "utf8");
          }
        }
      })
    )).rejects.toThrow(/pack validation linked path.*identity.*changed/i);
    expect(mutations).toBe(1);
  });

  test("revalidates an earlier scope path after later source-revision work", async () => {
    const pack = await v3Pack();
    const scopePath = "scope-dependency.txt";
    const laterSourcePath = "later-source.txt";
    const laterSourceContents = "later source\n";
    await writeFile(join(project().repository, scopePath), "stable scope\n", "utf8");
    await writeFile(join(project().repository, laterSourcePath), laterSourceContents, "utf8");
    pack.scope.paths.push(scopePath);
    pack.sourceRevision.files[laterSourcePath] = hash(laterSourceContents);
    let mutations = 0;

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async (path: string) => {
            if (path !== laterSourcePath || mutations > 0) return;
            mutations += 1;
            await appendFile(join(project().repository, scopePath), "late mutation\n", "utf8");
          }
        }
      })
    )).rejects.toThrow(/pack validation source scope.*identity.*changed/i);
    expect(mutations).toBe(1);
  });

  test("revalidates a missing tombstone dependency before returning", async () => {
    const pack = await v3Pack();
    const laterSourcePath = "later-missing-state-source.txt";
    const laterSourceContents = "later source\n";
    const tombstonePath = pack.archive.tombstones.path;
    await writeFile(join(project().repository, laterSourcePath), laterSourceContents, "utf8");
    pack.sourceRevision.files[laterSourcePath] = hash(laterSourceContents);
    let mutations = 0;

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async (path: string) => {
            if (path !== laterSourcePath || mutations > 0) return;
            mutations += 1;
            await mkdir(join(project().repository, "docs", "project-design", "archive"), { recursive: true });
            await writeFile(join(project().repository, ...tombstonePath.split("/")), "", "utf8");
          }
        }
      })
    )).rejects.toThrow(/pack validation (?:managed-tree directory|file).*identity.*changed/i);
    expect(mutations).toBe(1);
  });

  test("rejects Windows-equivalent aliases across pack path categories before I/O", async () => {
    const pack = await v3Pack();
    const exactPath = sourcePath();
    const aliasPath = exactPath.replace("evidence", "Evidence");
    expect(aliasPath).not.toBe(exactPath);
    pack.records[0].evidence[0].path = aliasPath;
    let openedFiles = 0;
    let managedEntries = 0;

    const result = await validatePack(
      { root: project().repository, pack },
      validationOptions({
        io: {
          afterProjectFileOpen: async () => { openedFiles += 1; },
          beforeManagedDirectoryEntry: async () => { managedEntries += 1; }
        }
      })
    ) as {
      errors: Array<{ code: string; message: string }>;
    };
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "repository_path_alias" })
    ]));
    expect(openedFiles).toBe(0);
    expect(managedEntries).toBe(0);
  });

  test.runIf(process.platform !== "win32")(
    "rejects Windows-equivalent aliases discovered in the managed tree",
    async () => {
      const pack = await v3Pack();
      await writeFile(
        join(project().repository, "docs", "project-design", "Intent.md"),
        "# portable alias collision\n",
        "utf8"
      );

      const result = await validatePack({ root: project().repository, pack }) as {
        errors: Array<{ code: string; message: string }>;
      };
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "repository_path_alias" })
      ]));
    }
  );

  test("counts unique missing evidence paths before filesystem probes", async () => {
    const pack = await v3Pack();
    const evidence = pack.records[0].evidence[0];
    pack.records[0].evidence.push(
      { ...evidence, path: "missing-evidence-a.txt" },
      { ...evidence, path: "missing-evidence-b.txt" }
    );

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({ limits: { scan: { maxFiles: 12 } } })
    )).rejects.toThrow(/pack validation files.*12 items/i);
  });

  test("counts unique Markdown link targets before filesystem probes", async () => {
    const pack = await v1Pack();
    const indexPath = pack.documents[0].path;
    await writeFile(join(project().repository, "linked-a.txt"), "a\n", "utf8");
    await writeFile(join(project().repository, "linked-b.txt"), "b\n", "utf8");
    await appendFile(
      join(project().repository, ...indexPath.split("/")),
      "\n[a](../../linked-a.txt) [b](../../linked-b.txt)\n",
      "utf8"
    );

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({ limits: { scan: { maxFiles: 10 } } })
    )).rejects.toThrow(/pack validation files.*10 items/i);
  });

  test("counts unique source-scope targets before filesystem probes", async () => {
    const pack = await v1Pack();
    await writeFile(join(project().repository, "scope-a.txt"), "a\n", "utf8");
    await writeFile(join(project().repository, "scope-b.txt"), "b\n", "utf8");
    pack.scope.paths.push("scope-a.txt", "scope-b.txt");

    await expect(validatePack(
      { root: project().repository, pack },
      validationOptions({ limits: { scan: { maxFiles: 10 } } })
    )).rejects.toThrow(/pack validation files.*10 items/i);
  });
});
