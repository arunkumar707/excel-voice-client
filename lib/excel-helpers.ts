import ExcelJS from "exceljs";
import type { GridCell } from "@/lib/grid-types";
import { pickDataEntrySheet } from "@/lib/sheet-picker";

const HEADER_SCAN_MAX_ROW = 30;
const MIN_HEADER_LIKE_CELLS = 2;

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: string }).text).trim();
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result: unknown }).result;
    return r === null || r === undefined ? "" : String(r).trim();
  }
  return String(v).trim();
}

/** Values that look like data cells, not labels (sl.no 1, dates, plain numbers). */
function isLikelyDataValue(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/^-?\d+(\.\d+)?$/.test(t)) return true;
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(t)) return true;
  return false;
}

function headerLikeCellCount(sheet: ExcelJS.Worksheet, rowNumber: number): number {
  const row = sheet.getRow(rowNumber);
  const maxCol = Math.max(
    row.actualCellCount,
    row.cellCount,
    sheet.columnCount ?? 0,
    1
  );
  let n = 0;
  for (let c = 1; c <= maxCol; c++) {
    const s = cellToString(row.getCell(c));
    if (!s) continue;
    if (isLikelyDataValue(s)) continue;
    n += 1;
  }
  return n;
}

/**
 * Many templates leave row 1 blank and put headers on row 2+.
 * Pick the first row (within scan range) with the strongest "label row" signal.
 */
export function detectHeaderRowIndex(sheet: ExcelJS.Worksheet): number {
  const scanEnd = Math.min(Math.max(sheet.rowCount, 1), HEADER_SCAN_MAX_ROW);
  let bestRow = 1;
  let bestScore = -1;
  for (let r = 1; r <= scanEnd; r++) {
    const score = headerLikeCellCount(sheet, r);
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  if (bestScore < MIN_HEADER_LIKE_CELLS) {
    throw new Error(
      "No column header row found in the first rows of the sheet. Put headers on one row near the top, or avoid leaving only numbers/dates in that row."
    );
  }
  return bestRow;
}

export function readHeaderLabels(
  sheet: ExcelJS.Worksheet,
  headerRowIndex: number
): { columns: string[]; colMap: Map<string, number> } {
  const headerRow = sheet.getRow(headerRowIndex);
  const maxCol = Math.max(
    headerRow.actualCellCount,
    headerRow.cellCount,
    sheet.columnCount ?? 0,
    1
  );
  const columns: string[] = [];
  const colMap = new Map<string, number>();
  for (let c = 1; c <= maxCol; c++) {
    const t = cellToString(headerRow.getCell(c));
    if (t) {
      columns.push(t);
      colMap.set(t, c);
    }
  }
  return { columns, colMap };
}

export async function parseExcelHeaders(buffer: Buffer): Promise<{
  columns: string[];
  sheetName: string;
  rowCount: number;
  headerRow: number;
}> {
  const workbook = new ExcelJS.Workbook();
  // exceljs declares its own `Buffer` type; Node's Buffer is compatible at runtime
  await workbook.xlsx.load(buffer as never);
  const sheet = pickDataEntrySheet(workbook);
  const headerRowIndex = detectHeaderRowIndex(sheet);
  const { columns } = readHeaderLabels(sheet, headerRowIndex);
  if (!columns.length) {
    throw new Error(
      `No column names found on row ${headerRowIndex} (detected header row).`
    );
  }
  return {
    columns,
    sheetName: sheet.name,
    rowCount: sheet.rowCount,
    headerRow: headerRowIndex,
  };
}

function columnIndexMap(
  sheet: ExcelJS.Worksheet,
  headerRowIndex: number
): Map<string, number> {
  return readHeaderLabels(sheet, headerRowIndex).colMap;
}

function lastDataRow(sheet: ExcelJS.Worksheet, headerRowIndex: number): number {
  let last = headerRowIndex;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > headerRowIndex) last = Math.max(last, rowNumber);
  });
  return last;
}

function firstEmptyRowInColumn(
  sheet: ExcelJS.Worksheet,
  colNumber: number,
  startRow: number
): number {
  for (let r = startRow; r <= sheet.rowCount + 500; r++) {
    const cell = sheet.getRow(r).getCell(colNumber);
    const v = cell.value;
    if (v === null || v === undefined || v === "") return r;
  }
  return sheet.rowCount + 1;
}

export type CellPrimitive = string | number | boolean | Date | null;

export type RowMapping = Record<string, CellPrimitive | CellPrimitive[]>;

export async function fillWorkbook(
  buffer: Buffer,
  mapping: RowMapping,
  mode: "row" | "column"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = pickDataEntrySheet(workbook);

  const headerRowIndex = detectHeaderRowIndex(sheet);
  const colMap = columnIndexMap(sheet, headerRowIndex);
  const firstDataRow = headerRowIndex + 1;

  if (mode === "row") {
    const rowIndex = lastDataRow(sheet, headerRowIndex) + 1;
    const row = sheet.getRow(rowIndex);
    for (const [key, val] of Object.entries(mapping)) {
      if (Array.isArray(val)) continue;
      const col = colMap.get(key);
      if (!col) continue;
      row.getCell(col).value = val as ExcelJS.CellValue;
    }
  } else {
    for (const [key, val] of Object.entries(mapping)) {
      const col = colMap.get(key);
      if (!col) continue;
      const arr = Array.isArray(val) ? val : val == null ? [] : [val];
      let r = firstEmptyRowInColumn(sheet, col, firstDataRow);
      for (const item of arr) {
        sheet.getRow(r).getCell(col).value = item as ExcelJS.CellValue;
        r += 1;
      }
    }
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export type { GridCell };

function cellToJsonValue(cell: ExcelJS.Cell): GridCell {
  const v = cell.value;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return v;
  if (v instanceof Date) {
    const d = v;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: string }).text);
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result: unknown }).result;
    if (r === null || r === undefined) return null;
    if (typeof r === "number" && !Number.isNaN(r)) return r;
    if (r instanceof Date) {
      const d = r;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${d.getFullYear()}`;
    }
    return String(r);
  }
  return String(v);
}

function computeUsedBounds(sheet: ExcelJS.Worksheet): { maxRow: number; maxCol: number } {
  let maxRow = 1;
  let maxCol = 1;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    maxRow = Math.max(maxRow, rowNumber);
    row.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber);
    });
  });
  return { maxRow, maxCol };
}

export function sheetToGrid(sheet: ExcelJS.Worksheet): {
  grid: GridCell[][];
  headerRow: number;
  columnLabels: string[];
  maxRow: number;
  maxCol: number;
} {
  const headerRow = detectHeaderRowIndex(sheet);
  const { columns } = readHeaderLabels(sheet, headerRow);
  const bounds = computeUsedBounds(sheet);
  const maxRow = Math.max(bounds.maxRow, headerRow);
  const headerRowObj = sheet.getRow(headerRow);
  const maxCol = Math.max(
    bounds.maxCol,
    headerRowObj.actualCellCount,
    headerRowObj.cellCount,
    sheet.columnCount ?? 0,
    1
  );

  const grid: GridCell[][] = [];
  for (let r = 1; r <= maxRow; r++) {
    const row: GridCell[] = [];
    for (let c = 1; c <= maxCol; c++) {
      row.push(cellToJsonValue(sheet.getRow(r).getCell(c)));
    }
    grid.push(row);
  }
  return {
    grid,
    headerRow,
    columnLabels: columns,
    maxRow,
    maxCol,
  };
}

export function applyGridToSheet(sheet: ExcelJS.Worksheet, grid: GridCell[][]): void {
  for (let r = 0; r < grid.length; r++) {
    const excelRow = sheet.getRow(r + 1);
    const cells = grid[r] ?? [];
    for (let c = 0; c < cells.length; c++) {
      const val = cells[c];
      const cell = excelRow.getCell(c + 1);
      if (val === null || val === undefined || val === "") {
        cell.value = null;
      } else {
        cell.value = val as ExcelJS.CellValue;
      }
    }
  }
}

export async function workbookBufferWithGrid(
  buffer: Buffer,
  sheetName: string,
  grid: GridCell[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet =
    sheetName.trim().length > 0
      ? (workbook.getWorksheet(sheetName) ?? pickDataEntrySheet(workbook))
      : pickDataEntrySheet(workbook);
  applyGridToSheet(sheet, grid);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
