import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { writeCanonicalPackFixture } from "./canonical-pack-fixture.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture missing");
  return fixture;
}

function hash(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

describe("validate_pack final disk view", () => {
  test("direct validation rejects a fully-owned on-disk Markdown orphan without an overlay", async () => {
    const pack = await writeCanonicalPackFixture(project());
    await writeFile(join(project().repository, "docs", "project-design", "orphan.md"), block("orphan.record", "Orphan\n"), "utf8");

    const result = await createProjectDesignKeeper().validatePack({ root: project().repository, pack });

    expect(result).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: "document_unmapped" })])
    });
  });
});

describe("canonical-only validate_pack", () => {
  test("direct validation rejects the legacy requiredEvidence shape", async () => {
    const result = await createProjectDesignKeeper().validatePack({
      root: project().repository,
      pack: { requiredEvidence: ["moon-garden"] }
    });

    expect(result).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: "schema_invalid" })])
    });
  });
});
