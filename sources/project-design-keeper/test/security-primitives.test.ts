import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  assertCursorCurrent,
  createCursorCodec,
  cursorExpiresAt,
  cursorMaximumLifetimeMs,
  parseHistoryCursorPayload,
  parseScopeCursorPayload
} from "../src/security/cursor.js";
import { probeProcessLiveness } from "../src/security/process-liveness.js";
import {
  createPublicationClaimOwner,
  parsePublicationClaimOwner,
  PUBLICATION_CLAIM_LEASE_MS
} from "../src/security/publication-claim.js";

const temporaryRoots = new Set<string>();
const initializationName = ".claim-00000000-0000-4000-8000-000000000000.tmp";
const publicationName = ".00000000-0000-4000-8000-000000000000.tmp";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

async function cursorFixture() {
  const root = await mkdtemp(join(tmpdir(), "keeper-security-primitives-"));
  temporaryRoots.add(root);
  const cacheDirectory = join(root, "cache");
  return {
    cacheDirectory,
    codec: await createCursorCodec({ cacheDirectory })
  };
}

function signedToken(json: string, key: Buffer): string {
  const body = Buffer.from(json, "utf8").toString("base64url");
  const mac = createHmac("sha256", key).update(body, "ascii").digest("base64url");
  return `${body}.${mac}`;
}

describe("cursor security primitives", () => {
  const scopePayload = {
    version: 2,
    snapshotId: "snapshot",
    scopeKey: "scope",
    view: "files",
    offset: 0,
    issuedAt: 10,
    expiresAt: 20
  } as const;

  const historyPayload = {
    version: 2,
    snapshotId: "snapshot",
    filterKey: "filter",
    offset: 0,
    issuedAt: 10,
    expiresAt: 20
  } as const;

  test("accepts every declared scope view and an exact history payload", () => {
    expect(["files", "evidence", "details"].map((view) =>
      parseScopeCursorPayload({ ...scopePayload, view }).view
    )).toEqual(["files", "evidence", "details"]);
    expect(parseHistoryCursorPayload(historyPayload)).toEqual(historyPayload);
  });

  test.each([
    ["null", null],
    ["an array", []],
    ["a missing field", { ...scopePayload, scopeKey: undefined }],
    ["an extra field", { ...scopePayload, extra: true }],
    ["the wrong version", { ...scopePayload, version: 1 }],
    ["an unknown view", { ...scopePayload, view: "summary" }],
    ["an empty binding", { ...scopePayload, scopeKey: "" }],
    ["an oversized UTF-8 binding", { ...scopePayload, scopeKey: "界".repeat(171) }],
    ["a fractional offset", { ...scopePayload, offset: 0.5 }],
    ["a negative offset", { ...scopePayload, offset: -1 }],
    ["a negative issue time", { ...scopePayload, issuedAt: -1 }],
    ["a zero expiry", { ...scopePayload, expiresAt: 0 }],
    ["an inverted interval", { ...scopePayload, issuedAt: 20, expiresAt: 20 }],
    ["an overlong interval", { ...scopePayload, expiresAt: 10 + cursorMaximumLifetimeMs + 1 }]
  ])("rejects a scope payload containing %s", (_label, value) => {
    expect(() => parseScopeCursorPayload(value)).toThrow(/cursor.*malformed|cursor.*tampered/i);
  });

  test("rejects an inexact history schema and invalid history version", () => {
    expect(() => parseHistoryCursorPayload({ ...historyPayload, filterKey: undefined }))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
    expect(() => parseHistoryCursorPayload({ ...historyPayload, version: 1 }))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
  });

  test("enforces issuance and expiry clock boundaries", () => {
    expect(() => assertCursorCurrent(scopePayload, -1)).toThrow(/validation clock.*invalid/i);
    expect(() => assertCursorCurrent(scopePayload, 9)).toThrow(/issued in the future/i);
    expect(() => assertCursorCurrent(scopePayload, 20)).toThrow(/expired/i);
    expect(() => assertCursorCurrent(scopePayload, 10)).not.toThrow();

    expect(cursorExpiresAt(10)).toBe(10 + cursorMaximumLifetimeMs);
    expect(() => cursorExpiresAt(-1)).toThrow(/issuance clock.*invalid/i);
    expect(() => cursorExpiresAt(Number.MAX_SAFE_INTEGER)).toThrow(/expiry.*invalid/i);
  });

  test("rejects cyclic, non-finite, unsupported, and independently bounded encoded values", async () => {
    const { codec } = await cursorFixture();
    const cyclicArray: unknown[] = [];
    cyclicArray.push(cyclicArray);
    const cyclicObject: Record<string, unknown> = {};
    cyclicObject.self = cyclicObject;

    for (const value of [cyclicArray, cyclicObject, { value: Number.NaN }, { value: undefined }, { value: 1n }]) {
      expect(() => codec.encode({ value })).toThrow(/cursor.*malformed|cursor.*tampered/i);
    }
    expect(() => codec.encode({ value: "x".repeat(3_065) }))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
    expect(() => codec.encode({ value: "x".repeat(3_050) }))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
  });

  test("rejects correctly signed but malformed or non-canonical bodies", async () => {
    const { cacheDirectory, codec } = await cursorFixture();
    const key = await readFile(join(cacheDirectory, "cursor-hmac.key"));
    const parse = (value: unknown) => value;

    expect(() => codec.decode(signedToken("{", key), parse)).toThrow(/cursor.*malformed|cursor.*tampered/i);
    expect(() => codec.decode(signedToken('{"z":1,"a":2}', key), parse))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
    expect(() => codec.decode(signedToken("", key), parse)).toThrow(/cursor.*malformed|cursor.*tampered/i);
    const valid = codec.encode({ version: 2 });
    expect(() => codec.decode(valid, () => { throw new Error("unsafe parser accepted input"); }))
      .toThrow(/cursor.*malformed|cursor.*tampered/i);
  });
});

describe("process liveness classification", () => {
  test.each([Number.NaN, 0, -1, 2_147_483_648])("fails closed for an unsafe PID (%s)", (pid) => {
    expect(probeProcessLiveness(pid)).toBe("ambiguous");
  });

  test("recognizes the current process without sending a signal", () => {
    const kill = vi.spyOn(process, "kill");
    expect(probeProcessLiveness(process.pid)).toBe("alive");
    expect(kill).not.toHaveBeenCalled();
  });

  test("classifies successful, missing, and permission-denied probes", () => {
    const kill = vi.spyOn(process, "kill");
    kill.mockImplementation(() => true);
    expect(probeProcessLiveness(2_000_000_000)).toBe("alive");

    kill.mockImplementation(() => {
      throw Object.assign(new Error("missing"), { code: "ESRCH" });
    });
    expect(probeProcessLiveness(2_000_000_000)).toBe("dead");

    kill.mockImplementation(() => {
      throw Object.assign(new Error("denied"), { code: "EPERM" });
    });
    expect(probeProcessLiveness(2_000_000_000)).toBe("ambiguous");
  });
});

describe("publication claim owner metadata", () => {
  test("creates and parses an exact bounded owner record", () => {
    const owner = createPublicationClaimOwner("target.json", initializationName, publicationName, 100);
    expect(owner).toEqual({
      version: 1,
      pid: process.pid,
      nonce: expect.stringMatching(/^[a-f0-9]{32}$/u),
      createdAtMs: 100,
      expiresAtMs: 100 + PUBLICATION_CLAIM_LEASE_MS,
      targetName: "target.json",
      initializationName,
      publicationName
    });
    expect(parsePublicationClaimOwner(owner, "target.json")).toEqual(owner);
  });

  test.each(["", ".", "..", "nested/target", "nested\\target"])(
    "rejects an unsafe target basename (%s)",
    (targetName) => {
      expect(() => createPublicationClaimOwner(targetName, initializationName, publicationName, 100))
        .toThrow(/target name.*invalid/i);
    }
  );

  test("rejects invalid timestamps and temporary-name roles", () => {
    expect(() => createPublicationClaimOwner("target", initializationName, publicationName, -1))
      .toThrow(/timestamp.*invalid/i);
    expect(() => createPublicationClaimOwner(
      "target",
      initializationName,
      publicationName,
      Number.MAX_SAFE_INTEGER - PUBLICATION_CLAIM_LEASE_MS + 1
    )).toThrow(/timestamp.*invalid/i);
    expect(() => createPublicationClaimOwner("target", publicationName, publicationName, 100))
      .toThrow(/initialization name.*invalid/i);
    expect(() => createPublicationClaimOwner("target", initializationName, initializationName, 100))
      .toThrow(/temporary name.*invalid/i);
  });

  test("rejects inexact, mismatched, and expired-interval owner records", () => {
    const owner = createPublicationClaimOwner("target", initializationName, publicationName, 100);
    expect(() => parsePublicationClaimOwner({ ...owner, extra: true }, "target"))
      .toThrow(/owner metadata.*invalid/i);
    expect(() => parsePublicationClaimOwner({ ...owner, pid: 0 }, "target"))
      .toThrow(/owner metadata.*invalid/i);
    expect(() => parsePublicationClaimOwner({ ...owner, expiresAtMs: owner.expiresAtMs + 1 }, "target"))
      .toThrow(/owner metadata.*invalid/i);
    expect(() => parsePublicationClaimOwner(owner, "other"))
      .toThrow(/owner metadata.*invalid/i);
  });
});
