import { NextRequest, NextResponse } from "next/server";
import { parseExcelHeaders } from "@/lib/excel-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const { columns, sheetName, rowCount, headerRow } =
      await parseExcelHeaders(buf);
    return NextResponse.json({ columns, sheetName, rowCount, headerRow });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
