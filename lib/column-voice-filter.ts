/**
 * column-voice-filter.ts
 *
 * Column-aware post-processing for voice input.
 * Detects the column type from its header text and applies the right
 * transformation to the raw spoken text BEFORE it is written to the grid.
 *
 * Rules (per column type):
 *  - slno      : convert spoken numbers → digits ("one" → "1", "twenty five" → "25")
 *  - name      : pass-through — do NOT alter Indian names
 *  - village   : pass-through — do NOT alter Indian village names
 *  - date      : extract digits and format as DD-MM-YYYY
 *               ("1952025" → "19-05-2025", "19 5 2025" → "19-05-2025")
 *  - phone     : strip non-digits and return the numeric string
 *  - ai / mm   : strip non-digits (these are numeric codes / months)
 *  - default   : pass-through
 */

export type ColKind =
  | "slno"
  | "name"
  | "village"
  | "date"
  | "phone"
  | "ai"
  | "mm"
  | "default";

/**
 * Returns true for column kinds whose spoken text should be sent to
 * /api/clean-text for GPT-based cleaning before filling the cell.
 * Currently unused — reserved for future column types that need server-side processing.
 */
export function needsServerFilter(): boolean {
  return false;
}

/** Map a header cell value to a ColKind. */
export function detectColKind(header: string | number | null | undefined): ColKind {
  if (header === null || header === undefined) return "default";
  const h = String(header).toLowerCase().trim();
  if (/sl\.?no|sl\s*no|serial|s\.no/.test(h)) return "slno";
  if (/phone|mobile|cell|contact|num/.test(h)) return "phone";
  if (/join|date|dob|birth/.test(h)) return "date";
  if (/village|vill|town|taluk|place|mandal/.test(h)) return "village";
  if (/farmer|name|grower|member/.test(h)) return "name";
  if (/\bai\b|artif/.test(h)) return "ai";
  if (/\bmm\b|month/.test(h)) return "mm";
  return "default";
}

// ─── Word-to-number table (0-29 + tens) ──────────────────────────────────────

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "twenty five" → 25, "seven" → 7, "3" → 3. Returns null if unrecognised. */
function wordsToNumber(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  // Already a plain number?
  if (/^\d+$/.test(t.trim())) return parseInt(t.trim(), 10);

  const tokens = t.split(/\s+/);
  let total = 0;
  let found = false;
  for (const tok of tokens) {
    if (tok in ONES) { total += ONES[tok]; found = true; }
    else if (tok in TENS) { total += TENS[tok]; found = true; }
  }
  return found ? total : null;
}

/** Apply Sl.no transform: spoken words or digits → clean integer string. */
function filterSlno(text: string): string {
  const n = wordsToNumber(text);
  return n !== null ? String(n) : text.trim();
}

/** Extract pure digits (for phone / AI / MM columns). */
function digitsOnly(text: string): string {
  const digits = text.replace(/\D/g, "");
  return digits || text.trim();
}

/**
 * Date formatting: extract digits and arrange as DD-MM-YYYY.
 *
 * Accepts patterns like:
 *   "19052025"  → "19-05-2025"
 *   "1952025"   → "19-05-2025"   (7 digits: d=19, m=05, y=2025 assumed)
 *   "19 5 2025" → "19-05-2025"
 *   "19/05/2025"→ "19-05-2025"
 *   "19-5-25"   → "19-05-2025"   (2-digit year → 2000s)
 */
function filterDate(text: string): string {
  // Try parsing separated date parts first (separator: space / / - .)
  const separated = text.trim().match(/^(\d{1,2})\s*[\/\-.\s]\s*(\d{1,2})\s*[\/\-.\s]\s*(\d{2,4})$/);
  if (separated) {
    const [, d, m, y] = separated;
    const year = y.length === 2 ? `20${y}` : y;
    return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${year}`;
  }

  // Strip everything except digits
  const digits = text.replace(/\D/g, "");

  if (digits.length === 8) {
    // DDMMYYYY
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  }
  if (digits.length === 7) {
    // Likely DMMYYYY (e.g. 1952025 → 19-05-2025 — user drops leading zero on month)
    // Heuristic: if first 2 digits ≤ 31 treat as two-digit day
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4);
    if (parseInt(dd, 10) <= 31 && parseInt(mm, 10) <= 12) {
      return `${dd}-${mm}-${yyyy}`;
    }
    // Fallback: 1-digit day
    return `${digits[0].padStart(2, "0")}-${digits.slice(1, 3)}-${digits.slice(3)}`;
  }
  if (digits.length === 6) {
    // DDMMYY → assume 20xx
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-20${digits.slice(4)}`;
  }

  // Cannot parse — return as-is
  return text.trim();
}

/**
 * Main entry point. Apply the column-kind transform to raw spoken text.
 * Returns the value that should be written to the grid cell.
 */
export function applyColVoiceFilter(rawText: string, kind: ColKind): string {
  // Strip all dots and commas as per user request to not put "." or "," anywhere
  let t = rawText.replace(/[.,]/g, "").trim();
  if (!t) return t;

  switch (kind) {
    case "slno":
      return filterSlno(t);

    case "name":
    case "village":
      // Preserve exactly as spoken — Indian names must not be altered
      return t;

    case "date":
      return filterDate(t);

    case "phone":
      return digitsOnly(t);

    case "ai":
    case "mm":
      // Raw text — pass through exactly as spoken, no changes
      return t;

    default:
      return t;
  }
}
