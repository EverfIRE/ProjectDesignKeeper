import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

async function withClient(run: (client: Client) => Promise<void>): Promise<void> {
  const server = await createProjectDesignKeeper().createMcpServer() as McpServer;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "task5-round3", version: "0.1.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
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

  test("real MCP validation rejects the same fully-owned on-disk Markdown orphan", async () => {
    const pack = await writeCanonicalPackFixture(project());
    await writeFile(join(project().repository, "docs", "project-design", "orphan.md"), block("orphan.record", "Orphan\n"), "utf8");

    await withClient(async (client) => {
      const result = await client.callTool({
        name: "validate_pack",
        arguments: { root: project().repository, pack }
      });
      expect(result.structuredContent).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([expect.objectContaining({ code: "document_unmapped" })])
      });
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

  test("real MCP validation rejects the legacy requiredEvidence shape", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "validate_pack",
        arguments: { root: project().repository, pack: { requiredEvidence: ["moon-garden"] } }
      });
      expect(result.structuredContent).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([expect.objectContaining({ code: "schema_invalid" })])
      });
    });
  });
});
