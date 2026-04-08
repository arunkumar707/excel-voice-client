import fs from "fs";
import path from "path";
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "excel_session";

const memory = new Map<string, Buffer>();

function dataDir(): string {
  return path.join(process.cwd(), ".data", "sessions");
}

function sessionFilePath(sessionId: string): string {
  return path.join(dataDir(), `${sessionId}.xlsx`);
}

function ensureDataDir(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function getSessionBuffer(sessionId: string): Buffer | null {
  const mem = memory.get(sessionId);
  if (mem) return mem;
  try {
    const p = sessionFilePath(sessionId);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setSessionBuffer(sessionId: string, buf: Buffer): void {
  memory.set(sessionId, buf);
  try {
    ensureDataDir();
    fs.writeFileSync(sessionFilePath(sessionId), buf);
  } catch {
    /* ignore disk errors; memory still holds */
  }
}
