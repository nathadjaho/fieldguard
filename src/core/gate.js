// The gate: the only code path that writes the record. Nemotron proposes; this
// decides, field by field, with a reason a person can read.
//
//   accepted            grounded in the note and passes every check
//   needs_confirmation  grounded, but a person must confirm (hedge, unknown place...)
//   rejected            not grounded, or a check caught a known failure
//   not_stated          the model left it empty, which is the right answer
//
// The gate is the same for every pipeline. A pipeline (src/pipelines/*) only
// supplies its form, its domain checks and how accepted fields become a record,
// so pipelines stay independent of each other and the gate can be improved once.
import { containsPhrase, words } from './text.js';
import { speakerOf } from './speakers.js';
import { detectFacts } from './review/transcriptFacts.js';

const EMPTY = new Set(['', 'unknown', 'inconnu', 'inconnue', 'n/a', 'na', 'none', 'null', 'not stated', 'non precise', 'not specified']);

function valueSupported(note, field, spec) {
  if (spec.kind === 'enum') return spec.values.includes(field.value);
  if (spec.kind === 'age') {
    const digits = field.value.match(/\d+/)?.[0];
    if (digits && field.quote.includes(digits)) return true;
    return detectFacts(field.quote).some((f) => f.kind === 'number' || f.kind === 'age');
  }
  if (spec.kind === 'text') return true; // free text is checked by the quote and the domain checks
  if (spec.kind === 'person') {
    // "David: I can share the figures" names David through the line's speaker.
    const speaker = speakerOf(note, field.quote);
    return containsPhrase(field.quote, field.value) || (speaker && words(speaker).join(' ') === words(field.value).join(' '));
  }
  return containsPhrase(field.quote, field.value);
}

export function judgeField(note, field, profile) {
  const spec = profile.fields[field.name];
  const out = { ...field, status: 'accepted', reasons: [] };
  if (!spec) return { ...out, status: 'rejected', reasons: ['not a field of this form'] };
  if (EMPTY.has(words(field.value).join(' '))) return { ...out, status: 'not_stated', reasons: [] };

  if (!field.quote.trim() || !containsPhrase(note, field.quote)) {
    return { ...out, status: 'rejected', reasons: ['the quote is not in the note, so the value is not grounded'] };
  }
  if (!valueSupported(note, field, spec)) {
    return { ...out, status: 'rejected', reasons: ['the value does not appear in its own quote'] };
  }

  const { hard, soft } = profile.guards(field, note);
  const hardReasons = hard.filter(Boolean);
  if (hardReasons.length) return { ...out, status: 'rejected', reasons: hardReasons };
  const softReasons = soft.filter(Boolean);
  if (softReasons.length) return { ...out, status: 'needs_confirmation', reasons: softReasons };
  return out;
}

/** Judge every proposed field and build the record from accepted ones only. */
export function runGate(note, proposal, profile) {
  const seen = new Set();
  const fields = [];
  for (const f of proposal) {
    const spec = profile.fields[f.name];
    if (!spec?.repeatable) {
      if (seen.has(f.name)) continue; // first proposal per single field wins
      seen.add(f.name);
    }
    fields.push(judgeField(note, f, profile));
  }
  const record = profile.buildRecord(fields.filter((f) => f.status === 'accepted'));
  const count = (s) => fields.filter((f) => f.status === s).length;
  // Optional: what the notes say that nobody proposed (omissions).
  const uncovered = profile.coverage ? profile.coverage(note, proposal) : [];
  return {
    profile: profile.id,
    fields,
    record,
    uncovered,
    summary: {
      accepted: count('accepted'),
      needs_confirmation: count('needs_confirmation'),
      rejected: count('rejected'),
      not_stated: count('not_stated')
    }
  };
}

/** What the record would hold if every non-empty proposal were written: the
 *  baseline the gate is measured against. */
export function recordWithoutGate(proposal, profile) {
  return profile.buildRecord(proposal.filter((f) => !EMPTY.has(words(f.value).join(' '))));
}
