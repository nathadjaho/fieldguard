// Text helpers shared by the gate and the guards: compare words the way a
// caseworker reads them, ignoring case, accents, punctuation and spacing.

export const fold = (s) =>
  String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’`´]/g, "'").replace(/[-‐‑–—]/g, ' ');

/** Words only, folded, for containment tests. */
export const words = (s) => fold(s).match(/[\p{L}\p{N}']+/gu) || [];

/** True when `needle` appears in `hay` as a run of whole words. */
export function containsPhrase(hay, needle) {
  const h = ` ${words(hay).join(' ')} `;
  const n = words(needle).join(' ');
  return n.length > 0 && h.includes(` ${n} `);
}

/** True when any cue (a phrase) appears in `text`. Returns the first match. */
export function findCue(text, cues) {
  return cues.find((c) => containsPhrase(text, c)) || null;
}
