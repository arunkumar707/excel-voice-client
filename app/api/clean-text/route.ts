import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

/**
 * POST /api/clean-text
 * Body: { text: string, colLabel: string }
 * Returns: { text: string }
 *
 * Uses GPT to clean / normalize a spoken cell value for columns
 * that contain free-form text (AI notes, MM notes, etc.).
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      // No key — return raw text unchanged
      const body = (await req.json()) as { text?: string };
      return NextResponse.json({ text: body.text ?? "" });
    }

    const body = (await req.json()) as { text?: string; colLabel?: string };
    const raw = (body.text ?? "").trim();
    const col = (body.colLabel ?? "").trim();

    if (!raw) return NextResponse.json({ text: "" });

    const openai = getOpenAI();
    const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You clean spoken-text input for a data-entry field labelled "${col}" in an Indian farmer database.
Fix obvious ASR spelling errors and normalize capitalization.
Do NOT change factual content, numbers, or domain terms.
Return ONLY valid JSON with one key: "text" (string).`,
        },
        { role: "user", content: `Raw spoken value:\n${raw}` },
      ],
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return NextResponse.json({ text: raw });



    let parsed: { text?: unknown };
    try {
      parsed = JSON.parse(content) as { text?: unknown };
    } catch {
      return NextResponse.json({ text: raw });
    }

    const cleaned =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : raw;

    return NextResponse.json({ text: cleaned });
  } catch {
    // On any error fall back to returning raw input
    const body = await req.json().catch(() => ({})) as { text?: string };
    return NextResponse.json({ text: body.text ?? "" });
  }
}
