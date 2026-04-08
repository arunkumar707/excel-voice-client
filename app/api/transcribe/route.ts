import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { postProcessTranscript } from "@/lib/voice-post-process";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";

/** Prefer whisper-1 unless OPENAI_TRANSCRIBE_MODEL is set (e.g. gpt-4o-transcribe when available). */
function transcribeModel(): string {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "whisper-1";
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not set. Create .env.local in the project root with OPENAI_API_KEY=sk-... and restart npm run dev. Or use “Browser dictate” in the app.",
          code: "OPENAI_API_KEY_MISSING",
        },
        { status: 503 }
      );
    }
    const form = await req.formData();
    const audio = form.get("audio");
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }
    const openai = getOpenAI();
    const ab = await audio.arrayBuffer();
    const buf = Buffer.from(ab);
    const name =
      audio instanceof File && audio.name ? audio.name : "recording.webm";
    let rawText: string;
    const primaryModel = transcribeModel();
    try {
      const file = await toFile(buf, name);
      const tr = await openai.audio.transcriptions.create({
        file,
        model: primaryModel,
      });
      rawText = (tr.text ?? "").trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (primaryModel !== "whisper-1") {
        try {
          const file2 = await toFile(buf, name);
          const tr = await openai.audio.transcriptions.create({
            file: file2,
            model: "whisper-1",
          });
          rawText = (tr.text ?? "").trim();
        } catch {
          return NextResponse.json(
            { error: msg, code: "TRANSCRIBE_FAILED" },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          { error: msg, code: "TRANSCRIBE_FAILED" },
          { status: 502 }
        );
      }
    }

    if (!rawText) {
      return NextResponse.json({ text: "", action: null, rawText: "" });
    }

    try {
      const { action, text } = await postProcessTranscript(openai, rawText);
      return NextResponse.json({
        text: text ?? "",
        action,
        rawText,
      });
    } catch {
      return NextResponse.json({
        text: rawText,
        action: null,
        rawText,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
