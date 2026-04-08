import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { cookies } from "next/headers";
import { sheetToGrid, workbookBufferWithGrid } from "@/lib/excel-helpers";
import type { GridCell } from "@/lib/grid-types";
import { readTemplateBuffer } from "@/lib/load-template";
import { listSheetNames, pickDataEntrySheet } from "@/lib/sheet-picker";
import {
  getSessionBuffer,
  newSessionId,
  setSessionBuffer,
  SESSION_COOKIE_NAME,
} from "@/lib/workbook-session";

export const runtime = "nodejs";

async function ensureSessionBuffer(sessionId: string): Promise<Buffer> {
  let buf = getSessionBuffer(sessionId);
  if (!buf) {
    buf = readTemplateBuffer();
    setSessionBuffer(sessionId, buf);
  }
  return buf;
}

export async function GET() {
  try {
    const jar = await cookies();
    let sessionId = jar.get(SESSION_COOKIE_NAME)?.value;
    let newCookie = false;
    if (!sessionId) {
      sessionId = newSessionId();
      newCookie = true;
    }
    const buf = await ensureSessionBuffer(sessionId);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf as never);
    const sheet = pickDataEntrySheet(workbook);
    const { grid, headerRow, columnLabels, maxRow, maxCol } = sheetToGrid(sheet);
    const res = NextResponse.json({
      sheetName: sheet.name,
      headerRow,
      columnLabels,
      grid,
      rowCount: maxRow,
      colCount: maxCol,
      sheetNames: listSheetNames(workbook),
    });
    if (newCookie && sessionId) {
      res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const jar = await cookies();
    let sessionId = jar.get(SESSION_COOKIE_NAME)?.value;
    let setCookie = false;
    if (!sessionId) {
      sessionId = newSessionId();
      setCookie = true;
    }
    const body = (await req.json()) as {
      sheetName?: string;
      grid?: unknown;
    };
    if (!Array.isArray(body.grid)) {
      return NextResponse.json({ error: "Invalid grid" }, { status: 400 });
    }
    const grid = body.grid as GridCell[][];
    const base = await ensureSessionBuffer(sessionId);
    const sheetName =
      typeof body.sheetName === "string" && body.sheetName.trim()
        ? body.sheetName.trim()
        : undefined;
    const out = await workbookBufferWithGrid(base, sheetName ?? "", grid);
    setSessionBuffer(sessionId, out);
    const res = NextResponse.json({ ok: true });
    if (setCookie && sessionId) {
      res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
