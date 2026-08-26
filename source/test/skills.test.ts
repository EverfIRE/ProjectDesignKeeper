import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { strictHistoryKnowledgeRecordSchema } from "../src/types/schema.js";

const root = resolve(import.meta.dirname, "..");
const skillRoot = resolve(root, "skills/distill-project-design");

async function text(relativePath: string): Promise<string> {
  return readFile(resolve(skillRoot, relativePath), "utf8");
}

describe("distill-project-design skill assets", () => {
  test("main skill has canonical trigger metadata and direct reference routes", async () => {
    const skill = await text("SKILL.md");
    expect(skill).toMatch(/^---\nname: distill-project-design\ndescription: Use when[^\n]+\n---\n/u);
    expect(skill).not.toMatch(/\bTODO\b|Structuring This Skill|\[TODO:/u);
    for (const reference of ["workflow", "knowledge-model", "document-contract", "tool-contract"]) {
      expect(skill).toContain(`references/${reference}.md`);
      await expect(text(`references/${reference}.md`)).resolves.toMatch(/^# /u);
    }
  });

  test("generated project skill uses the canonical owned envelope and valid managed hashes", async () => {
    const generated = await text("assets/project-design-context/SKILL.md");
    expect(generated).toMatch(/^---\nname: project-design-context\ndescription: "Use when[^\n]+"\nmetadata:\n  managed-by: project-design-keeper\n---\n/u);
    const expression = /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:managed -->/gu;
    const matches = [...generated.matchAll(expression)];
    expect(matches.length).toBeGreaterThan(0);
    const frontmatterEnd = generated.indexOf("---\n", 4) + 4;
    expect(matches.map((match) => match[0]).join("").trim()).toBe(generated.slice(frontmatterEnd).trim());
    for (const match of matches) {
      const actual = `sha256:${createHash("sha256").update(match[3], "utf8").digest("hex")}`;
      expect(match[2]).toBe(actual);
    }
  });

  test("ships the schema 3.0 manifest and all twelve responsibility-focused document templates", async () => {
    const manifest = JSON.parse(await text("assets/knowledge-pack/manifest.json")) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      managedBy: "project-design-keeper",
      schemaVersion: "3.0",
      maintenanceRevision: 0,
      archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
      dedupeExceptions: []
    });
    const records = manifest.records as Array<{ id: string; kind: string; ownerDocument: string }>;
    const manifestRecordIds = new Set(records.map((record) => record.id));
    expect(records.every((record) => Boolean(record.kind && record.ownerDocument))).toBe(true);

    const templates = [
      "index.md.template",
      "intent.md.template",
      "principles.md.template",
      "architecture.md.template",
      "module.md.template",
      "conventions.md.template",
      "decisions.md.template",
      "tuning.md.template",
      "verification.md.template",
      "open-questions.md.template",
      "evidence-map.md.template",
      "archive-index.md.template"
    ];
    for (const template of templates) {
      const contents = await text(`assets/knowledge-pack/${template}`);
      expect(contents).not.toMatch(/content-hash="sha256:[a-f0-9]{64}"/u);
      const navigationOnly = template === "index.md.template" || template === "evidence-map.md.template" || template === "archive-index.md.template";
      expect(contents).toContain("{{DERIVED_BLOCK:");
      const begin = contents.indexOf("{{DERIVED_BLOCK:");
      const end = contents.lastIndexOf(" END}}");
      expect(contents.slice(0, begin).trim()).toBe("");
      expect(end).toBeGreaterThan(begin);
      expect(contents.slice(end + " END}}".length).trim()).toBe("");
      if (!navigationOnly) {
        expect(contents).toContain("{{MANAGED_BLOCK:");
        const renderedId = /\{\{MANAGED_BLOCK:([^ ]+) BEGIN\}\}/u.exec(contents)?.[1].replace("{{MODULE_SLUG}}", "example");
        expect(renderedId).toBeTruthy();
        expect(manifestRecordIds).toContain(renderedId);
      } else {
        expect(contents).not.toContain("{{MANAGED_BLOCK:");
      }
    }
  });

  test("project context prompt explicitly names its generated skill", async () => {
    const generated = await text("assets/project-design-context/SKILL.md");
    expect(generated).toMatch(/^---\nname: project-design-context\n/u);
  });

  test("documents executable MCP call mappings for every scope and minimal context", async () => {
    const skill = await text("SKILL.md");
    const workflow = await text("references/workflow.md");
    const generated = await text("assets/project-design-context/SKILL.md");
    expect(`${skill}\n${workflow}`).toContain("scan_scope { root, path: <each-explicit-file>, view: \"files\" }");
    expect(`${skill}\n${workflow}`).toContain("search_evidence { root, path?, query: <feature-name> }");
    expect(`${skill}\n${workflow}`).toContain("scan_scope { root, view: \"summary\" }");
    expect(`${skill}\n${workflow}`).toContain("view: \"evidence\"");
    expect(generated).toContain("query_context");
    expect(generated).toContain("root: <repo>");
    expect(generated).toContain("query");
    expect(generated).toContain("paths");
    expect(generated).toContain("modules");
    expect(`${skill}\n${workflow}`).toContain("query_history");
    expect(`${skill}\n${workflow}`).toContain("analyze_redundancy");
  });

  test("ships a parseable lossless Schema 1/2 to 3 migration recipe", async () => {
    const workflow = await text("references/workflow.md");
    const example = /<!-- schema-migration-example -->\n```json\n([\s\S]*?)\n```/u.exec(workflow)?.[1];
    expect(example).toBeTruthy();

    const mapping = JSON.parse(example!) as {
      legacySchemaVersion: string;
      maintenanceRevision: number;
      legacyManagedBody: string;
      candidateManagedBody: string;
      legacy: Record<string, unknown>;
      candidate: Record<string, unknown>;
      missingLifecycleRules: {
        legacySchemaVersions: string[];
        nonterminalCandidateLifecycle: Record<string, unknown>;
        superseded: {
          legacyStatus: string;
          supersededBy: string;
          candidateLifecycle: Record<string, unknown>;
        };
      };
      unsupportedLegacyExtension: { action: string };
      incompatibleExistingLifecycle: { action: string };
      documentRule: {
        derivedBlocksPerMappedDocument: number;
        placement: string;
        managedBlocksNestedInsideDerived: boolean;
        navigationManagedBlocks: number;
      };
    };
    const { legacy, candidate } = mapping;
    expect(mapping.legacySchemaVersion).toBe("2.0");
    expect(strictHistoryKnowledgeRecordSchema.safeParse(candidate).success).toBe(true);
    expect(mapping.candidateManagedBody).toBe(mapping.legacyManagedBody);
    for (const field of [
      "id", "kind", "ownerDocument", "domain", "scope", "statement", "impact", "status", "strength", "approval",
      "lifecycle", "supersedes", "supersededBy", "conflicts", "openQuestions", "module", "modules", "path", "paths", "summary"
    ]) {
      expect(candidate[field]).toEqual(legacy[field]);
    }
    expect(candidate.assertedConfidence).toBe(legacy.confidence);
    expect(candidate).not.toHaveProperty("confidence");
    expect(candidate.legacyEvidence).toEqual(legacy.evidence);
    expect(candidate.legacyStatus).toBe(legacy.status);
    expect(candidate.evidence).toEqual([expect.objectContaining({ path: "Source/cache.ts", startLine: 7 })]);
    expect((candidate.lifecycle as Record<string, unknown>).sinceRevision).toBeLessThanOrEqual(mapping.maintenanceRevision);
    expect(mapping.missingLifecycleRules).toEqual({
      legacySchemaVersions: ["1.0", "2.0"],
      nonterminalCandidateLifecycle: { state: "active" },
      superseded: {
        legacyStatus: "superseded",
        supersededBy: "decision.cache-policy-v2",
        candidateLifecycle: {
          state: "terminal",
          reason: "superseded",
          sinceRevision: 0,
          confirmedRefreshes: 1,
          successorIds: ["decision.cache-policy-v2"]
        }
      }
    });
    expect(mapping.unsupportedLegacyExtension.action).toBe("conflict-stop");
    expect(mapping.incompatibleExistingLifecycle.action).toBe("conflict-stop");
    expect(mapping.documentRule).toEqual({
      derivedBlocksPerMappedDocument: 1,
      placement: "separate",
      managedBlocksNestedInsideDerived: false,
      navigationManagedBlocks: 0
    });
    expect(candidate.lifecycle).toEqual({
      state: "terminal",
      reason: "superseded",
      sinceRevision: 1,
      confirmedRefreshes: 1,
      successorIds: [legacy.supersededBy]
    });
  });

  test("generated project context skill blocks design-changing work until the user chooses", async () => {
    const generated = await text("assets/project-design-context/SKILL.md");
    expect(generated).toContain("aligned");
    expect(generated).toContain("conflict");
    expect(generated).toContain("gap");
    expect(generated).toContain("stale");
    expect(generated).toContain("pending design decision");
    expect(generated).toContain("pending knowledge sync");
    expect(generated).toMatch(/must not (?:plan|modify|execute)[\s\S]+user (?:chooses|choice)/iu);
    expect(generated).toMatch(/semantic confirmation[\s\S]+not[\s\S]+write confirmation/iu);
  });
});
