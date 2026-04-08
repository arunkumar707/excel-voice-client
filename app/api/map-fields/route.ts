import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { buildMappingPrompt, type FillMode } from "@/lib/mapping-prompt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const columns: unknown = body.columns;
    const voiceText: unknown = body.voiceText;
    const mode: FillMode = body.mode === "column" ? "column" : "row";
    if (!Array.isArray(columns) || !columns.every((c) => typeof c === "string")) {
      return NextResponse.json({ error: "Invalid columns" }, { status: 400 });
    }
    if (typeof voiceText !== "string" || !voiceText.trim()) {
      return NextResponse.json({ error: "Invalid voiceText" }, { status: 400 });
    }
    const openai = getOpenAI();
    const prompt = buildMappingPrompt(columns as string[], voiceText.trim(), mode);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You only output valid minified JSON objects. No markdown fences, no commentary.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw },
        { status: 502 }
      );
    }
    const cols = columns as string[];
    const mapping: Record<string, unknown> = {};
    for (const c of cols) {
      if (Object.prototype.hasOwnProperty.call(parsed, c)) {
        mapping[c] = parsed[c];
      } else {
        mapping[c] = null;
      }
    }
    return NextResponse.json({ mapping });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mapping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
