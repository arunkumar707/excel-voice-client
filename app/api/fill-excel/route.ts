import { NextRequest, NextResponse } from "next/server";
import { fillWorkbook, type RowMapping } from "@/lib/excel-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const mappingRaw = form.get("mapping");
    const mode = form.get("mode") === "column" ? "column" : "row";
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof mappingRaw !== "string") {
      return NextResponse.json({ error: "Missing mapping JSON" }, { status: 400 });
    }
    const mapping = JSON.parse(mappingRaw) as RowMapping;
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await fillWorkbook(buf, mapping, mode);
    const originalName = file instanceof File && file.name ? file.name : "workbook.xlsx";
    const outName = originalName.replace(/\.xlsx?$/i, "") + "-filled.xlsx";
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${outName}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fill failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
