// Notes written one line per speaker: "Name: text".
import { containsPhrase } from './text.js';

/** Speaker of the line that holds `quote`, for notes written "Name: text". */
export function speakerOf(note, quote) {
  for (const line of String(note).split(/\r?\n/)) {
    const m = line.match(/^\s*([^:\n]{1,40}?)\s*:\s*(.*)$/);
    if (m && containsPhrase(line, quote)) return m[1].trim();
  }
  return null;
}
