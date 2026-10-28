// Second pass. When the gate rejects a field, a larger Nemotron re-reads the
// note for that field only, told why the first answer was refused. Its answer
// goes through the same gate: the retry can fix a field, mark it not stated or
// be refused again, but it never writes the record either.
//
// Fields a domain check rejected (an accident recorded as self-harm, "we could"
// recorded as a decision) are retried too: the reason tells the model what the
// note does and does not say, and the gate still has the last word.
import { judgeField, finishGate } from './gate.js';
import { parseProposal } from './prompt.js';

const key = (f) => `${f.name}#${f.group ?? ''}`;

/** The fields worth a second look: the ones the gate refused. */
export function retryTargets(gate) {
  return gate.fields.filter((f) => f.status === 'rejected');
}

export function buildRetryMessages(note, lang = 'en', profile, targets) {
  const fields = [...new Set(targets.map((t) => t.name))].map((n) => {
    const f = profile.fields[n];
    return `- ${n}: ${f?.label || n}${f?.values ? ` (one of: ${f.values.join(', ')})` : ''}`;
  }).join('\n');
  const refused = targets.map((t) => JSON.stringify({
    name: t.name, ...(t.group != null ? { group: t.group } : {}),
    value: t.value, quote: t.quote, refused_because: t.reasons.join('; ')
  })).join('\n');
  return [
    {
      role: 'system',
      content: `${profile.task}
A first reader proposed the fields below, and a checker written in plain code refused each
one for the reason given. Re-read the notes for these fields only. For each, either:
- give a value the notes state, with the exact words of the notes that state it in "quote"
  (verbatim, no paraphrase), or
- give an empty value and an empty quote if the notes do not state it.
Do not repeat a refused value unless you can quote words that support it. Do not guess.

Fields:
${fields}

For each field also give "speaker" and "certainty" ("certain" if stated plainly,
"uncertain" if the notes hedge). Keep the same "group" as the refused field.
Answer with JSON only:
{"fields":[{"name":"...","value":"","quote":"","speaker":"","certainty":"certain","group":1}]}
Values in the language of the notes.`
    },
    {
      role: 'user',
      content: `Notes (${lang === 'fr' ? 'French' : 'English'}):\n"""\n${note}\n"""\n\nRefused fields, one per line:\n${refused}`
    }
  ];
}

/**
 * Judge the retry answer and fold it into the first pass. Each retried field
 * keeps a trace of its first answer, so the page can show both.
 */
export function mergeRetry(note, profile, firstGate, retryText, model) {
  const answers = new Map(parseProposal(retryText, profile).map((f) => [key(f), f]));
  const fields = firstGate.fields.map((f) => {
    if (f.status !== 'rejected') return f;
    // Same field and group; else the only answer for that field name (the first
    // pass may have no group while the retry numbers it, as on 28 Oct).
    const byName = [...answers.values()].filter((a) => a.name === f.name);
    const again = answers.get(key(f)) || answers.get(`${f.name}#`) || (byName.length === 1 ? byName[0] : undefined);
    if (!again) return f;
    const judged = judgeField(note, { ...again, group: f.group }, profile);
    return { ...judged, retry: { model, first: { value: f.value, quote: f.quote, reasons: f.reasons } } };
  });
  // Coverage counts what was ever proposed, so a line quoted on the retry
  // is no longer "possibly missed".
  const proposal = [...firstGate.fields, ...fields.filter((f) => f.retry)];
  return { ...finishGate(note, fields, proposal, profile), retried: fields.filter((f) => f.retry).length };
}
