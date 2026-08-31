import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-pack-gate-"));
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true });
  fixture = undefined;
  cacheDirectory = undefined;
});

function root(): string {
  if (!fixture) throw new Error("fixture missing");
  return fixture.repository;
}

function cache(): string {
  if (!cacheDirectory) throw new Error("cache missing");
  return cacheDirectory;
}

function managedChange(path: string) {
  return { path, managedBlock: { recordId: "gate.record", content: "# Gate\n" } };
}

async function withClient(run: (client: Client) => Promise<void>): Promise<void> {
  const server = await createProjectDesignKeeper({ cacheDirectory: cache() }).createMcpServer() as McpServer;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "pack-gate-test", version: "0.1.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

const docsAliases = [
  "docs/project-design/gate.md",
  "./docs/project-design/gate.md",
  "docs\\project-design\\gate.md",
  "DOCS/PROJECT-DESIGN/gate.md"
] as const;

describe("core candidate pack gate", () => {
  test.each(docsAliases)("direct preview rejects packless docs alias %s before cache writes", async (path) => {
    const api = createProjectDesignKeeper({ cacheDirectory: cache() });
    await expect(api.previewUpdate({ root: root(), changes: [managedChange(path)] })).rejects.toThrow(/candidate pack/i);
    await expect(readdir(cache())).resolves.toEqual([]);
  });

  test.each(docsAliases)("MCP preview delegates packless docs alias %s to the same core gate", async (path) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "preview_update",
        arguments: { root: root(), changes: [managedChange(path)] }
      });
      expect(result).toMatchObject({ isError: true });
    });
    await expect(readdir(cache())).resolves.toEqual([]);
  });

  test("keeps a project-context Skill-only preview pack-optional", async () => {
    const api = createProjectDesignKeeper({ cacheDirectory: cache() });
    await expect(api.previewUpdate({
      root: root(),
      changes: [managedChange(".agents/skills/project-design-context/context.md")]
    })).resolves.toMatchObject({ applicable: true });
  });
});
