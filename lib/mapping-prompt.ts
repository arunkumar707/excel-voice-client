export type FillMode = "row" | "column";

export function buildMappingPrompt(
  columns: string[],
  voiceText: string,
  mode: FillMode
): string {
  const columnList = columns.join(", ");
  const columnModeHint =
    mode === "column"
      ? `
If the user gives multiple values for one column (e.g. a list of names), return that field as a JSON array of strings or numbers.
Example: { "Name": ["Arun", "Ravi", "Sita"] }
Only use arrays when multiple values clearly belong to the same column.
`
      : `
Return a single value per column (not arrays). One spoken row of data.
`;

  return `You are an intelligent data extraction assistant.

You are given:
1. Excel column names (exact keys you must use in JSON)
2. A spoken sentence converted to text

Your job:
- Extract values from the sentence
- Map them correctly to the Excel columns
- Return STRICT JSON only, no markdown
- Use EXACTLY these keys and no others: ${JSON.stringify(columns)}
- If a value is missing for a column, use null
${columnModeHint}
Rules:
- Understand synonyms (e.g. "city" may map to a column named "Location")
- Handle unordered input
- Handle partial data
- Convert numbers to JSON numbers when appropriate
- Dates as ISO strings (YYYY-MM-DD) when clearly a date

Column names (in order for reference): ${columnList}

User input:
"${voiceText.replace(/"/g, '\\"')}"

Output: one JSON object whose keys are exactly the column names listed above.`;
}
