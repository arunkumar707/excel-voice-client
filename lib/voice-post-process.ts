import type OpenAI from "openai";
import type { TranscribeAction } from "@/lib/voice-intent";

const SYSTEM = `You post-process speech-to-text for an Indian farmer data-entry Excel grid (columns: Sl.no, Name of the farmer, Village Name, Joining date, AI, MM, Phone number).

Fix obvious spelling errors. Normalize common Indian personal names and city/village names to sensible Roman spellings when the transcript is clearly a mishearing. Do not invent facts or numbers not implied by the transcript.

Return ONLY valid JSON with exactly two keys:
- "action": null OR one of the strings "NEXT_ROW", "NEXT_COLUMN", "CLEAR"
- "text": a string or null

Rules:
1) If the user said ONLY navigation or clear — not dictating a cell value — set "action" to the matching value and "text" to null:
   - Next row / row next / go to next line → "NEXT_ROW"
   - Next column / next col → "NEXT_COLUMN"
   - Clear / clear cell / erase / delete cell → "CLEAR"
2) If they are dictating content for the current cell (name, village, phone, number, date, Sl.no, etc.), set "action" to null and "text" to one cleaned value for that cell. If they say patterns like "Name Arun" or "farmer Arun", return "Arun". If they pack several fields in one utterance meant as one cell, keep one reasonable line; if clearly multiple distinct values for one cell, join with a single space or comma as appropriate.
3) Use null for "text" when "action" is set.`;

const ACTIONS = new Set<string>(["NEXT_ROW", "NEXT_COLUMN", "CLEAR"]);

export async function postProcessTranscript(
  openai: OpenAI,
  raw: string
): Promise<{ action: TranscribeAction | null; text: string | null }> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { action: null, text: null };
  }
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Raw transcript:\n${trimmed}` },
    ],
  });
  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    return { action: null, text: trimmed };
  }
  let parsed: { action?: unknown; text?: unknown };
  try {
    parsed = JSON.parse(content) as { action?: unknown; text?: unknown };
  } catch {
    return { action: null, text: trimmed };
  }
  const act =
    typeof parsed.action === "string" && ACTIONS.has(parsed.action)
      ? (parsed.action as TranscribeAction)
      : null;
  const tx =
    parsed.text === null || parsed.text === undefined
      ? null
      : String(parsed.text).trim();
  if (act) {
    return { action: act, text: null };
  }
  return { action: null, text: tx === "" ? trimmed : tx };
}
