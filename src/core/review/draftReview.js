// Copied from TRACE (github.com/ElkeDikoume/trace-humanitarian, src/v2/lib/draftReview.js).
// Copyright (c) 2026 Elke-Esmeralda Dikoume. Contributed to FieldGuard under the
// Apache License 2.0 with the author's permission. Unchanged apart from this header.

// The rules of the draft review, apart from the screen that shows them.
//
// A machine transcript is a draft. Every number, date, time, age, place and
// name in it, and every word the recognizer itself was unsure of, is an item
// the caseworker must keep, correct or mark "not stated" before the draft can
// become a note. These functions are that rule. TranscriptDraftReview.jsx only
// draws it, so the rule can be tested without a browser and cannot drift from
// what the screen enforces.
//
// Every function takes a review state and returns a new one. Nothing mutates.
//
// THE ONE GUARANTEE: finishReview() returns null while anything is unchecked.
// The screen's Save button calls it and passes on only what it returns, so no
// path through the screen saves an unconfirmed number, even if the button's
// disabled state were ever wrong.
import { carryRanges, detectFacts, lowConfidenceRanges, reviewItems, spelledNumberCoverage } from './transcriptFacts.js';

/**
 * @param {string} text the machine transcript
 * @param {{ words?: {word: string, confidence: number}[], threshold?: number, langs?: string[] }} [opts]
 */
export function startReview(text, { words, threshold = 0.6, langs } = {}) {
  const draft = text ?? '';
  return {
    machineDraft: draft,
    draft,
    langs: langs && langs.length ? langs : undefined,
    unsure: lowConfidenceRanges(draft, words, threshold),
    confirmed: [],
    corrections: [],
    editedByHand: false,
    readThrough: false
  };
}

/** True when the note may contain spelled numbers or uncapitalised place
 *  names this detector cannot see, so a whole-draft read-through is required. */
export const needsReadThrough = (state) =>
  Boolean(state.langs) && spelledNumberCoverage(state.langs).uncovered.length > 0;

export const itemsOf = (state) =>
  reviewItems(state.draft, { langs: state.langs, unsure: state.unsure, confirmed: state.confirmed });

/** Things standing between the caseworker and Save. The read-through counts
 *  as one, so the number on screen is the number of things actually left. */
export function remaining(state) {
  const open = itemsOf(state).filter((it) => !it.confirmed).length;
  return open + (needsReadThrough(state) && !state.readThrough ? 1 : 0);
}

/** The next unchecked item at or after `from`, wrapping to the first. */
export function nextItem(state, from = 0) {
  const pending = itemsOf(state).filter((it) => !it.confirmed);
  return pending.find((it) => it.start >= from) || pending[0] || null;
}

const sameItem = (a, b) => a.start === b.start && a.end === b.end && a.text === b.text;
const stillThere = (state, item) => itemsOf(state).some((it) => sameItem(it, item));

/** The machine heard it right. The unsure mark, if any, stays, so a kept word
 *  shows both that the machine doubted it and that a person checked it. */
export function keepItem(state, item) {
  if (!stillThere(state, item)) return state;
  if (state.confirmed.some((c) => sameItem(c, item))) return state;
  return { ...state, confirmed: [...state.confirmed, { start: item.start, end: item.end, text: item.text }] };
}

/**
 * Replace the item with what the caseworker says it should be. What they typed
 * is their own reading, so any fact inside it counts as checked by the act of
 * typing it. Everything else that was checked and is untouched stays checked.
 * An empty value is refused: "not stated" is the way to say there is nothing.
 */
export function correctItem(state, item, value, extra = {}) {
  if (!stillThere(state, item)) return state;
  if (typeof value !== 'string' || !value.trim()) return state;
  if (value === item.text) return keepItem(state, item);
  const draft = state.draft.slice(0, item.start) + value + state.draft.slice(item.end);
  const editEnd = item.start + value.length;
  const typed = detectFacts(draft, { langs: state.langs })
    .filter((f) => f.start < editEnd && item.start < f.end)
    .map((f) => ({ start: f.start, end: f.end, text: f.text }));
  // The typed text itself is checked even when it holds no fact at all, so a
  // place corrected to a lowercase phrase does not vanish from the record of
  // what was looked at.
  const self = { start: item.start, end: editEnd, text: value };
  return {
    ...state,
    draft,
    confirmed: [...carryRanges(state.confirmed, state.draft, draft), ...typed, self],
    unsure: carryRanges(state.unsure, state.draft, draft),
    corrections: [...state.corrections, { from: item.text, to: value, kind: item.kind, ...extra }]
  };
}

/**
 * The speaker did not say this; the machine filled it in, or it came from
 * noise. The item is replaced by `marker` (the interface's "[not stated]") so
 * the record shows a gap where a guess would otherwise have been, and the
 * correction is logged with `notStated: true`.
 */
export function markNotStated(state, item, marker) {
  return correctItem(state, item, marker, { notStated: true });
}

/** The caseworker rewrote the text freely. Only what changed needs checking
 *  again; a changed text also needs reading through again. */
export function editWhole(state, nextDraft) {
  if (nextDraft === state.draft) return state;
  return {
    ...state,
    draft: nextDraft,
    confirmed: carryRanges(state.confirmed, state.draft, nextDraft),
    unsure: carryRanges(state.unsure, state.draft, nextDraft),
    editedByHand: true,
    readThrough: false
  };
}

export const setReadThrough = (state, value) => ({ ...state, readThrough: Boolean(value) });

/**
 * The checked text and a record of what changed, or null if anything is still
 * unchecked. The machine's draft is returned beside the text so there is a
 * record of what was corrected; whether a profile KEEPS it (the trafficking
 * profile especially) is a data-minimisation decision for the caller.
 */
export function finishReview(state) {
  if (remaining(state) > 0) return null;
  return {
    text: state.draft,
    record: {
      machineDraft: state.machineDraft,
      corrections: state.corrections,
      editedByHand: state.editedByHand,
      notStated: state.corrections.filter((c) => c.notStated).length
    }
  };
}
