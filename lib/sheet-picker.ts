import ExcelJS from "exceljs";

const DATA_ENTRY_HINT = /data\s*entry/i;

/**
 * Prefer a sheet whose name suggests the main data table; else first sheet.
 */
export function pickDataEntrySheet(
  workbook: ExcelJS.Workbook
): ExcelJS.Worksheet {
  const sheets = workbook.worksheets;
  if (!sheets.length) {
    throw new Error("No worksheets found");
  }
  const match = sheets.find((s) => DATA_ENTRY_HINT.test(s.name));
  return match ?? sheets[0];
}

export function listSheetNames(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((s) => s.name);
}
