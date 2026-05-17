/**
 * TXT Parser
 *
 * Parses plain text files into line-based entries for subtitle/text clip creation.
 * Each non-empty line becomes a separate text clip.
 */

export interface TxtEntry {
  index: number;
  text: string;
}

/**
 * Parse a plain text file into an array of TxtEntry objects.
 * Each non-empty line becomes an entry.
 */
const MAX_TXT_ENTRIES = 5000;

export function parseTxt(content: string): TxtEntry[] {
  // Strip BOM (Windows Notepad adds this) and normalize line endings
  const stripped = content.replace(/^\uFEFF/, "");
  const normalized = stripped.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_TXT_ENTRIES)
    .map((text, i) => ({ index: i + 1, text }));
}
