import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TEMPLATE_FILENAME } from "@/lib/template-path";
import { readTemplateBuffer } from "@/lib/load-template";
import { getSessionBuffer, SESSION_COOKIE_NAME } from "@/lib/workbook-session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE_NAME)?.value;
    let buf: Buffer | null = null;
    if (sessionId) buf = getSessionBuffer(sessionId);
    if (!buf) buf = readTemplateBuffer();
    const name = TEMPLATE_FILENAME.replace(/\.xlsx$/i, "") + "-working.xlsx";
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
