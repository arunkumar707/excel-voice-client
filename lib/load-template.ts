import fs from "fs";
import { TEMPLATE_XLSX_PATH } from "@/lib/template-path";

export function readTemplateBuffer(): Buffer {
  if (!fs.existsSync(TEMPLATE_XLSX_PATH)) {
    throw new Error(
      `Template not found at ${TEMPLATE_XLSX_PATH}. Run: node scripts/create-default-template.cjs`
    );
  }
  return fs.readFileSync(TEMPLATE_XLSX_PATH);
}
