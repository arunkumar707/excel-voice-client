/**
 * If the utterance is only a navigation/clear command, return it; otherwise null (treat as cell value).
 */
export function parseVoiceCommand(
  raw: string
): "next-row" | "next-column" | "clear" | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?]+$/g, "");
  if (!t) return null;
  if (t === "next column" || t === "next col" || t === "column next") {
    return "next-column";
  }
  if (t === "next row" || t === "row next") {
    return "next-row";
  }
  if (
    t === "clear" ||
    t === "clear cell" ||
    t === "erase" ||
    t === "delete" ||
    t === "delete cell"
  ) {
    return "clear";
  }
  return null;
}
