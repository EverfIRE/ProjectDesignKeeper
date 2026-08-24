import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function requiredPath(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the explicit Task 10 local acceptance runner`);
  return resolve(value);
}

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

const exemptionsPath = requiredPath("KEEPER_PLUGIN_EVAL_EXEMPTIONS_PATH");
const marketplacePath = requiredPath("KEEPER_MARKETPLACE_PATH");

describe("explicit Task 10 host-local acceptance", () => {
  test("limits private-plugin evaluation exemptions to the three unavailable public URLs", async () => {
    const policy = await json(exemptionsPath) as { exemptions?: Array<Record<string, unknown>> };
    expect((policy.exemptions ?? []).map((entry) => entry.checkId).sort()).toEqual([
      "interface-missing-privacyPolicyURL",
      "interface-missing-termsOfServiceURL",
      "interface-missing-websiteURL"
    ]);
  });

  test("keeps exactly one approved personal marketplace entry", async () => {
    const marketplace = await json(marketplacePath) as { plugins?: Array<Record<string, unknown>> };
    const entries = (marketplace.plugins ?? []).filter((plugin) => plugin.name === "project-design-keeper");
    expect(entries).toEqual([{
      name: "project-design-keeper",
      source: { source: "local", path: "./plugins/project-design-keeper" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools"
    }]);
  });
});
