/**
 * Generates app/assest/Arun01.xlsx if missing (sample structure matching farmer template).
 * Run: node scripts/create-default-template.cjs
 */
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "app", "assest");
const outFile = path.join(outDir, "Arun01.xlsx");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const wb = new ExcelJS.Workbook();

  /** Same column titles as the Voice Excel grid (image / Data Entry Form). */
  const dataEntryHeaders = [
    "Sl.no",
    "Name of the farmer",
    "Village Name",
    "Joining date",
    "AI",
    "MM",
    "Phone number",
  ];

  /* Single sheet: seven columns only (matches app download). */
  const de = wb.addWorksheet("Data Entry Format");
  const deRow1 = de.getRow(1);
  dataEntryHeaders.forEach((h, i) => {
    deRow1.getCell(i + 1).value = h;
  });
  for (let c = 1; c <= dataEntryHeaders.length; c++) {
    de.getColumn(c).width = 25;
  }

  /* No sample data rows — user fills via voice/grid. */
  await wb.xlsx.writeFile(outFile);
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
