import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Tells the client whether server-side Whisper can run (no secrets exposed). */
export async function GET() {
  const whisper = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({ whisper });
}
