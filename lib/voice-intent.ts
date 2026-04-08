/** Unified shape from Whisper API or browser dictate normalization. */
export type VoiceIntent =
  | { type: "action"; action: "NEXT_ROW" | "NEXT_COLUMN" | "CLEAR" }
  | { type: "text"; text: string };

export type TranscribeAction = "NEXT_ROW" | "NEXT_COLUMN" | "CLEAR";
