import { parseVoiceCommand } from "@/lib/voice-commands";
import type { TranscribeAction, VoiceIntent } from "@/lib/voice-intent";

const API_ACTIONS = new Set<string>(["NEXT_ROW", "NEXT_COLUMN", "CLEAR"]);

/** Map /api/transcribe JSON (or raw browser string) to a single VoiceIntent. */
export function transcriptResponseToIntent(data: {
  text?: string;
  action?: string | null;
}): VoiceIntent {
  if (data.action && API_ACTIONS.has(data.action)) {
    return {
      type: "action",
      action: data.action as TranscribeAction,
    };
  }
  const raw = (data.text ?? "").trim();
  const cmd = parseVoiceCommand(raw);
  if (cmd === "next-row") return { type: "action", action: "NEXT_ROW" };
  if (cmd === "next-column") return { type: "action", action: "NEXT_COLUMN" };
  if (cmd === "clear") return { type: "action", action: "CLEAR" };
  return { type: "text", text: raw };
}
