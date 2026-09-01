import { randomBytes } from "node:crypto";

export const PUBLICATION_CLAIM_LEASE_MS = 30_000;

// This is immutable one-shot publication metadata, not a renewable project/process lock.
// Task 8 may reuse process-liveness.ts, but must define its own exact lock schema.
export interface PublicationClaimOwner {
  version: 1;
  pid: number;
  nonce: string;
  createdAtMs: number;
  expiresAtMs: number;
  targetName: string;
  initializationName: string;
  publicationName: string;
}

const exactOwnerKeys = [
  "createdAtMs",
  "expiresAtMs",
  "initializationName",
  "nonce",
  "pid",
  "publicationName",
  "targetName",
  "version"
] as const;

const canonicalUuidV4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const initializationNamePattern = new RegExp(`^\\.claim-${canonicalUuidV4}\\.tmp$`, "u");
const publicationNamePattern = new RegExp(`^\\.${canonicalUuidV4}\\.tmp$`, "u");

function invalidOwner(): never {
  throw new Error("Publication claim owner metadata is invalid");
}

function validTargetName(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value !== "." && value !== ".." && !/[\\/]/u.test(value);
}

export function createPublicationClaimOwner(
  targetName: string,
  initializationName: string,
  publicationName: string,
  now = Date.now()
): PublicationClaimOwner {
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - PUBLICATION_CLAIM_LEASE_MS) {
    throw new Error("Publication claim timestamp is invalid");
  }
  if (!validTargetName(targetName)) throw new Error("Publication claim target name is invalid");
  if (!initializationNamePattern.test(initializationName)) {
    throw new Error("Publication claim initialization name is invalid");
  }
  if (!publicationNamePattern.test(publicationName)) {
    throw new Error("Publication temporary name is invalid");
  }
  return {
    version: 1,
    pid: process.pid,
    nonce: randomBytes(16).toString("hex"),
    createdAtMs: now,
    expiresAtMs: now + PUBLICATION_CLAIM_LEASE_MS,
    targetName,
    initializationName,
    publicationName
  };
}

export function parsePublicationClaimOwner(value: unknown, expectedTargetName: string): PublicationClaimOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidOwner();
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en-US"));
  if (keys.length !== exactOwnerKeys.length || keys.some((key, index) => key !== exactOwnerKeys[index])) invalidOwner();
  if (
    record.version !== 1 ||
    !Number.isSafeInteger(record.pid) || Number(record.pid) <= 0 || Number(record.pid) > 2_147_483_647 ||
    typeof record.nonce !== "string" || !/^[a-f0-9]{32}$/u.test(record.nonce) ||
    !Number.isSafeInteger(record.createdAtMs) || Number(record.createdAtMs) < 0 ||
    !Number.isSafeInteger(record.expiresAtMs) ||
    Number(record.expiresAtMs) - Number(record.createdAtMs) !== PUBLICATION_CLAIM_LEASE_MS ||
    !validTargetName(record.targetName) ||
    record.targetName !== expectedTargetName ||
    typeof record.initializationName !== "string" || !initializationNamePattern.test(record.initializationName) ||
    typeof record.publicationName !== "string" || !publicationNamePattern.test(record.publicationName)
  ) invalidOwner();
  return {
    version: 1,
    pid: Number(record.pid),
    nonce: record.nonce,
    createdAtMs: Number(record.createdAtMs),
    expiresAtMs: Number(record.expiresAtMs),
    targetName: record.targetName,
    initializationName: record.initializationName,
    publicationName: record.publicationName
  };
}
