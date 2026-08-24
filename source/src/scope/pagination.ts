import { Buffer } from "node:buffer";
import {
  assertCursorCurrent,
  cursorMaximumLifetimeMs,
  parseScopeCursorPayload,
  type CursorCodec,
  type ScopeCursorPayload
} from "../security/cursor.js";

export type ScopeView = "summary" | "files" | "evidence";

export async function pageItems<T>(input: {
  items: readonly T[];
  limit: number;
  codec: CursorCodec;
  now: number;
  expiresAt: number;
  cursor?: string;
  snapshotId: string;
  scopeKey: string;
  view: "files" | "evidence" | "details";
  byteBudget?: number;
}): Promise<{ items: T[]; page: { limit: number; nextCursor?: string; complete: boolean } }> {
  if (!Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.expiresAt) ||
      input.expiresAt <= input.now || input.expiresAt - input.now > cursorMaximumLifetimeMs) {
    throw new Error("Scan cursor retention expiry is invalid");
  }
  const cursor = input.cursor ? input.codec.decode(input.cursor, parseScopeCursorPayload) : undefined;
  if (cursor) assertCursorCurrent(cursor, input.now);
  if (cursor && (cursor.snapshotId !== input.snapshotId || cursor.scopeKey !== input.scopeKey || cursor.view !== input.view)) {
    throw new Error("Scan cursor does not belong to this snapshot, scope, or view");
  }
  if (cursor && cursor.expiresAt !== input.expiresAt) {
    throw new Error("Scan cursor expiry does not match the retained snapshot expiry");
  }
  const offset = cursor?.offset ?? 0;
  if (offset > input.items.length) throw new Error("Scan cursor offset exceeds the available result set");
  const items: T[] = [];
  let bytes = 2;
  const byteBudget = input.byteBudget ?? Number.POSITIVE_INFINITY;
  for (let index = offset; index < input.items.length && items.length < input.limit; index += 1) {
    const candidate = input.items[index];
    const candidateBytes = Buffer.byteLength(JSON.stringify(candidate), "utf8") + (items.length > 0 ? 1 : 0);
    if (items.length > 0 && bytes + candidateBytes > byteBudget) break;
    items.push(candidate);
    bytes += candidateBytes;
  }
  const nextOffset = offset + items.length;
  const complete = nextOffset >= input.items.length;
  return {
    items,
    page: {
      limit: input.limit,
      ...(complete ? {} : { nextCursor: input.codec.encode({
        version: 2,
        snapshotId: input.snapshotId,
        scopeKey: input.scopeKey,
        view: input.view,
        offset: nextOffset,
        issuedAt: cursor?.issuedAt ?? input.now,
        expiresAt: cursor?.expiresAt ?? input.expiresAt
      } satisfies ScopeCursorPayload) }),
      complete
    }
  };
}

export function scanLimit(value: unknown): number {
  if (value === undefined) return 200;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1000) {
    throw new Error("Scan limit must be an integer between 1 and 1000");
  }
  return Number(value);
}

export function scanView(value: unknown): ScopeView {
  if (value === undefined) return "summary";
  if (value !== "summary" && value !== "files" && value !== "evidence") {
    throw new Error("Scan view must be summary, files, or evidence");
  }
  return value;
}
