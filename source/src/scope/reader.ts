import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { ByteBudget, CounterBudget, DeadlineBudget } from "../security/limits.js";
import type { Evidence, ScopeFileEntry, ScopeOmission } from "../types/schema.js";

export interface ScopeReaderIo {
  beforeStat?: (path: string) => Promise<void>;
  beforeOpen?: (path: string) => Promise<void>;
  afterOpenIdentityCheck?: (path: string) => Promise<void>;
  onChunkRead?: (path: string, bytes: number, totalBytes: number) => Promise<void>;
  beforeFinalIdentityCheck?: (path: string) => Promise<void>;
}

export interface ReadIndexedFileInput {
  absolutePath: string;
  outputPath: string;
  bytes: ByteBudget;
  evidence: CounterBudget;
  deadline: DeadlineBudget;
  maxFileBytes: number;
}

export interface ReadIndexedFileResult {
  file?: ScopeFileEntry;
  evidence: Evidence[];
  omission?: ScopeOmission;
}

const maximumLinePrefixBytes = 16 * 1024;

function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function sameIdentity(
  left: BigIntStats,
  right: BigIntStats
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid &&
    left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

function appendBoundedPrefix(prefix: string, value: string): string {
  let remaining = maximumLinePrefixBytes - Buffer.byteLength(prefix, "utf8");
  if (remaining <= 0 || value.length === 0) return prefix;
  if (Buffer.byteLength(value, "utf8") <= remaining) return prefix + value;
  let appended = prefix;
  for (const character of value) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (bytes > remaining) break;
    appended += character;
    remaining -= bytes;
  }
  return appended;
}

function budgetOmission(input: ReadIndexedFileInput, reason: ScopeOmission["reason"], size?: number): ReadIndexedFileResult {
  return {
    evidence: [],
    omission: { path: input.outputPath, reason, ...(size === undefined ? {} : { size }) }
  };
}

export async function readIndexedFile(
  input: ReadIndexedFileInput,
  io: ScopeReaderIo = {}
): Promise<ReadIndexedFileResult> {
  const lexicalPath = resolve(input.absolutePath);
  try {
    input.deadline.check();
    await io.beforeStat?.(lexicalPath);
    input.deadline.check();
  } catch (error) {
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline");
    }
    throw error;
  }
  let metadata: BigIntStats;
  try {
    metadata = await lstat(lexicalPath, { bigint: true });
  } catch {
    return budgetOmission(input, "unreadable");
  }
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 0) return budgetOmission(input, "file-bytes");
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(lexicalPath);
  } catch {
    return budgetOmission(input, "unsafe", size);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile() || !samePath(canonicalPath, lexicalPath)) {
    return budgetOmission(input, "unsafe", size);
  }
  if (size > input.maxFileBytes) {
    return budgetOmission(input, "file-bytes", size);
  }
  try {
    input.deadline.check();
  } catch {
    return budgetOmission(input, "deadline", size);
  }
  try {
    input.bytes.consume(size);
  } catch {
    return budgetOmission(input, "aggregate-bytes", size);
  }

  try {
    await io.beforeOpen?.(lexicalPath);
    input.deadline.check();
  } catch (error) {
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    throw error;
  }
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(lexicalPath, "r");
  } catch {
    return budgetOmission(input, "unreadable", size);
  }

  let result: ReadIndexedFileResult;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameIdentity(metadata, opened) || Number(opened.size) !== size) {
      return budgetOmission(input, "unsafe", size);
    }
    await io.afterOpenIdentityCheck?.(lexicalPath);
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }

    // Preserve a leading UTF-8 BOM as U+FEFF so line byte counts and the
    // bounded prefix both describe the original repository bytes exactly.
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const digest = createHash("sha256");
    const evidence: Evidence[] = [];
    let bytesRead = 0;
    let prefix = "";
    let lineBytes = 0;
    let lastLineCharacter = "";
    let lineNumber = 1;
    let endedWithNewline = false;
    let binary = false;
    let deadlineExceeded = false;
    let evidenceExceeded = false;

    const append = (value: string) => {
      lineBytes += Buffer.byteLength(value, "utf8");
      prefix = appendBoundedPrefix(prefix, value);
      if (value.length > 0) lastLineCharacter = value.at(-1)!;
    };
    const finishLine = (stripCarriageReturn: boolean): boolean => {
      let exactBytes = lineBytes;
      let text = prefix;
      if (stripCarriageReturn && exactBytes > 0) {
        exactBytes -= 1;
        if (text.endsWith("\r")) text = text.slice(0, -1);
      }
      try {
        input.evidence.consume();
      } catch {
        evidenceExceeded = true;
        return false;
      }
      const prefixBytes = Buffer.byteLength(text, "utf8");
      evidence.push({
        path: input.outputPath,
        line: lineNumber,
        text,
        ...(prefixBytes < exactBytes ? { truncated: true, textBytes: exactBytes } : {})
      });
      lineNumber += 1;
      prefix = "";
      lineBytes = 0;
      lastLineCharacter = "";
      return true;
    };
    const decodeLines = (value: string): boolean => {
      let start = 0;
      for (;;) {
        const newline = value.indexOf("\n", start);
        if (newline < 0) break;
        const segment = value.slice(start, newline);
        append(segment);
        if (!finishLine(lastLineCharacter === "\r")) return false;
        endedWithNewline = true;
        start = newline + 1;
      }
      const remainder = value.slice(start);
      if (remainder.length > 0) {
        append(remainder);
        endedWithNewline = false;
      }
      return true;
    };

    try {
      const stream = size === 0 ? undefined : handle.createReadStream({
        autoClose: false,
        highWaterMark: 64 * 1024,
        start: 0,
        end: size - 1
      });
      for await (const value of stream ?? []) {
        try {
          input.deadline.check();
        } catch {
          deadlineExceeded = true;
          stream?.destroy();
          break;
        }
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        bytesRead += chunk.byteLength;
        await io.onChunkRead?.(lexicalPath, chunk.byteLength, bytesRead);
        try {
          input.deadline.check();
        } catch {
          deadlineExceeded = true;
          stream?.destroy();
          break;
        }
        if (bytesRead > size) {
          stream?.destroy();
          return budgetOmission(input, "unsafe", size);
        }
        digest.update(chunk);
        if (chunk.includes(0)) {
          binary = true;
          stream?.destroy();
          break;
        }
        let decoded: string;
        try {
          decoded = decoder.decode(chunk, { stream: true });
        } catch {
          binary = true;
          stream?.destroy();
          break;
        }
        if (!decodeLines(decoded)) {
          stream?.destroy();
          break;
        }
      }
      if (!binary && !deadlineExceeded && !evidenceExceeded) {
        let tail: string;
        try {
          tail = decoder.decode();
        } catch {
          binary = true;
          tail = "";
        }
        if (!binary && decodeLines(tail) && !endedWithNewline && bytesRead > 0) finishLine(false);
      }
    } catch {
      if (!binary && !deadlineExceeded && !evidenceExceeded) return budgetOmission(input, "unreadable", size);
    }

    if (binary) return budgetOmission(input, "binary", size);
    if (deadlineExceeded) return budgetOmission(input, "deadline", size);
    if (evidenceExceeded) return budgetOmission(input, "evidence-limit", size);
    if (bytesRead !== size) return budgetOmission(input, "unsafe", size);

    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }

    await io.beforeFinalIdentityCheck?.(lexicalPath);
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    let finalPath: BigIntStats;
    let finalCanonical: string;
    try {
      [finalPath, finalCanonical] = await Promise.all([
        lstat(lexicalPath, { bigint: true }),
        realpath(lexicalPath)
      ]);
    } catch {
      return budgetOmission(input, "unsafe", size);
    }
    const finalHandle = await handle.stat({ bigint: true });
    if (!sameIdentity(metadata, finalPath) || !sameIdentity(metadata, finalHandle) ||
        Number(finalPath.size) !== size || Number(finalHandle.size) !== size || !samePath(finalCanonical, lexicalPath)) {
      return budgetOmission(input, "unsafe", size);
    }
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    result = {
      file: {
        path: input.outputPath,
        fingerprint: `sha256:${digest.digest("hex")}`,
        size,
        lineCount: evidence.length
      },
      evidence
    };
  } finally {
    await handle.close();
  }
  return result;
}
