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

function expectSchemaInvalid(result: unknown): void {
  expect(result).toMatchObject({
    valid: false,
    errors: expect.arrayContaining([expect.objectContaining({ code: "schema_invalid" })])
  });
}

describe("canonical pack ownership", () => {
  test.each([
    ["missing", undefined],
    ["wrong", "another-writer"]
  ])("direct validation rejects %s managedBy ownership", async (_label, managedBy) => {
    const pack = await writeCanonicalPackFixture(project());
    if (managedBy === undefined) delete pack.managedBy;
    else pack.managedBy = managedBy;

    expectSchemaInvalid(await createProjectDesignKeeper().validatePack({ root: project().repository, pack }));
  });
});

const invalidDocumentPaths = [
  ".agents/skills/project-design-context/extra.md",
  "docs/project-design/manifest.json",
  "docs/project-design/notes.txt"
] as const;

async function packWithDocument(path: string): Promise<Record<string, unknown>> {
  const pack = await writeCanonicalPackFixture(project());
  (pack.documents as Array<Record<string, unknown>>).push({ id: "document.extra", path });
  return pack;
}

describe("manifest Markdown document paths", () => {
  test.each(invalidDocumentPaths)("direct validation rejects manifest document path %s", async (path) => {
    const pack = await packWithDocument(path);
    expectSchemaInvalid(await createProjectDesignKeeper().validatePack({ root: project().repository, pack }));
  });
});
