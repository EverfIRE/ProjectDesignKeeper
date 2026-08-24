import { Buffer } from "node:buffer";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServiceOptions } from "../types/schema.js";
import { prepareSecureCache, publishExclusiveFile, validateCacheFile, type SecureCacheLayout } from "./cache.js";

export const cursorMaximumLifetimeMs = 7 * 24 * 60 * 60 * 1000;

const cursorTokenBytes = 4096;
const cursorBodyBytes = 3072;
const hmacBytes = 32;
const encodedHmacBytes = 43;
const base64Url = /^[A-Za-z0-9_-]+$/u;

export interface CursorCodec {
  encode(payload: Record<string, unknown>): string;
  decode<T>(token: string, parse: (value: unknown) => T): T;
}

export type CursorView = "files" | "evidence" | "details";

export interface ScopeCursorPayload {
  version: 2;
  snapshotId: string;
  scopeKey: string;
  view: CursorView;
  offset: number;
  issuedAt: number;
  expiresAt: number;
}

export interface HistoryCursorPayload {
  version: 2;
  snapshotId: string;
  filterKey: string;
  offset: number;
  issuedAt: number;
  expiresAt: number;
}

function malformedCursor(): Error {
  return new Error("Cursor is malformed or tampered");
}

function canonicalValue(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw malformedCursor();
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw malformedCursor();
    ancestors.add(value);
    const normalized = value.map((item) => canonicalValue(item, ancestors));
    ancestors.delete(value);
    return normalized;
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) throw malformedCursor();
    ancestors.add(value);
    const normalized = Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en-US"))
      .map(([key, nested]) => [key, canonicalValue(nested, ancestors)]));
    ancestors.delete(value);
    return normalized;
  }
  throw malformedCursor();
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new Set()));
}

function decodeBase64Url(value: string, maximumBytes: number): Buffer {
  if (!value || !base64Url.test(value) || value.length % 4 === 1) throw malformedCursor();
  if (value.length > Math.ceil(maximumBytes * 4 / 3)) throw malformedCursor();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength > maximumBytes || decoded.toString("base64url") !== value) throw malformedCursor();
  return decoded;
}

function exactObject(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw malformedCursor();
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort((left, right) => left.localeCompare(right, "en-US"));
  const expected = [...fields].sort((left, right) => left.localeCompare(right, "en-US"));
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) throw malformedCursor();
  return object;
}

function boundedBinding(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || Buffer.byteLength(value, "utf8") > 512) throw malformedCursor();
  return value;
}

function safeOffset(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw malformedCursor();
  return Number(value);
}

function cursorTimes(object: Record<string, unknown>): Pick<ScopeCursorPayload, "issuedAt" | "expiresAt"> {
  if (!Number.isSafeInteger(object.issuedAt) || Number(object.issuedAt) < 0 ||
      !Number.isSafeInteger(object.expiresAt) || Number(object.expiresAt) <= 0) throw malformedCursor();
  const issuedAt = Number(object.issuedAt);
  const expiresAt = Number(object.expiresAt);
  if (issuedAt >= expiresAt || expiresAt - issuedAt > cursorMaximumLifetimeMs) throw malformedCursor();
  return { issuedAt, expiresAt };
}

export function parseScopeCursorPayload(value: unknown): ScopeCursorPayload {
  const object = exactObject(value, ["version", "snapshotId", "scopeKey", "view", "offset", "issuedAt", "expiresAt"]);
  if (object.version !== 2 || (object.view !== "files" && object.view !== "evidence" && object.view !== "details")) {
    throw malformedCursor();
  }
  return {
    version: 2,
    snapshotId: boundedBinding(object.snapshotId),
    scopeKey: boundedBinding(object.scopeKey),
    view: object.view,
    offset: safeOffset(object.offset),
    ...cursorTimes(object)
  };
}

export function parseHistoryCursorPayload(value: unknown): HistoryCursorPayload {
  const object = exactObject(value, ["version", "snapshotId", "filterKey", "offset", "issuedAt", "expiresAt"]);
  if (object.version !== 2) throw malformedCursor();
  return {
    version: 2,
    snapshotId: boundedBinding(object.snapshotId),
    filterKey: boundedBinding(object.filterKey),
    offset: safeOffset(object.offset),
    ...cursorTimes(object)
  };
}

export function assertCursorCurrent(cursor: Pick<ScopeCursorPayload, "issuedAt" | "expiresAt">, now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Cursor validation clock is invalid");
  if (now < cursor.issuedAt) throw new Error("Cursor was issued in the future");
  if (now >= cursor.expiresAt) throw new Error("Cursor has expired");
}

export function cursorExpiresAt(issuedAt: number): number {
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new Error("Cursor issuance clock is invalid");
  const expiresAt = issuedAt + cursorMaximumLifetimeMs;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt) throw new Error("Cursor expiry is invalid");
  return expiresAt;
}

async function readKey(layout: SecureCacheLayout, path: string): Promise<Buffer | undefined> {
  try {
    await validateCacheFile(layout, path, false);
    const key = await readFile(path);
    if (key.byteLength !== hmacBytes) throw new Error("Persistent cursor key is invalid");
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || /component is missing|no such file/i.test(String((error as Error).message))) {
      return undefined;
    }
    throw error;
  }
}

async function loadOrCreateCursorKey(layout: SecureCacheLayout): Promise<Buffer> {
  const path = join(layout.root, "cursor-hmac.key");
  const existing = await readKey(layout, path);
  if (existing) return existing;
  try {
    await publishExclusiveFile(layout, path, randomBytes(hmacBytes));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const created = await readKey(layout, path);
  if (!created) throw new Error("Persistent cursor key could not be created");
  return created;
}

function hmacCursorCodec(key: Buffer): CursorCodec {
  const mac = (body: string) => createHmac("sha256", key).update(body, "ascii").digest();
  return {
    encode(payload) {
      const json = canonicalJson(payload);
      if (Buffer.byteLength(json, "utf8") > cursorBodyBytes) throw malformedCursor();
      const body = Buffer.from(json, "utf8").toString("base64url");
      const token = `${body}.${mac(body).toString("base64url")}`;
      if (Buffer.byteLength(token, "utf8") > cursorTokenBytes) throw malformedCursor();
      return token;
    },
    decode(token, parse) {
      try {
        if (typeof token !== "string" || Buffer.byteLength(token, "utf8") > cursorTokenBytes) throw malformedCursor();
        const parts = token.split(".");
        if (parts.length !== 2) throw malformedCursor();
        const [body, encodedMac] = parts as [string, string];
        if (encodedMac.length !== encodedHmacBytes) throw malformedCursor();
        const supplied = decodeBase64Url(encodedMac, hmacBytes);
        if (supplied.byteLength !== hmacBytes) throw malformedCursor();
        const expected = mac(body);
        if (!timingSafeEqual(supplied, expected)) throw malformedCursor();
        const bodyBytes = decodeBase64Url(body, cursorBodyBytes);
        const json = bodyBytes.toString("utf8");
        const value = JSON.parse(json) as unknown;
        if (canonicalJson(value) !== json) throw malformedCursor();
        return parse(value);
      } catch {
        throw malformedCursor();
      }
    }
  };
}

export async function createCursorCodec(options: ServiceOptions = {}, projectRoot?: string): Promise<CursorCodec> {
  const layout = await prepareSecureCache(options, projectRoot);
  return hmacCursorCodec(await loadOrCreateCursorKey(layout));
}
