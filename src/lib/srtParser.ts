/**
 * SRT (SubRip) Parser
 *
 * Parses .srt subtitle files into structured entries with timing and text.
 * Supports standard SRT format:
 *   1
 *   00:00:01,000 --> 00:00:04,000
 *   First subtitle line
 *
 *   2
 *   00:00:05,000 --> 00:00:08,000
 *   Second subtitle line
 */

export interface SrtEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Parse SRT timestamp to seconds.
 * Format: HH:MM:SS,mmm or HH:MM:SS.mmm
 */
function parseTimestamp(ts: string): number {
  const cleaned = ts.trim().replace(",", ".");
  const match = cleaned.match(/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    parseInt(ms.padEnd(3, "0"), 10) / 1000
  );
}

/**
 * Parse an SRT file string into an array of SrtEntry objects.
 */
export function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];

  // Strip BOM (Windows Notepad adds this) and normalize line endings
  const stripped = content.replace(/^\uFEFF/, "");
  const normalized = stripped.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/).filter((b) => b.trim().length > 0);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // First line: index number
    const index = parseInt(lines[0].trim(), 10);
    if (isNaN(index)) continue;

    // Second line: timestamp range
    const timeLine = lines[1].trim();
    const timeMatch = timeLine.match(
      /^([\d:.,]+)\s*-->\s*([\d:.,]+)/,
    );
    if (!timeMatch) continue;

    const startTime = parseTimestamp(timeMatch[1]);
    const endTime = parseTimestamp(timeMatch[2]);

    // Remaining lines: subtitle text (strip HTML tags)
    const text = lines
      .slice(2)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (text.length === 0) continue;

    entries.push({ index, startTime, endTime, text });
  }

  return entries;
}
