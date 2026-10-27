// What Nemotron is asked to do: PROPOSE fields, each with the exact words of
// the note that support it. It is told to leave unknown fields empty, but the
// gate does not rely on that instruction: our Apertus red-teaming showed a
// "do not guess" line still left 23 of 40 role-town errors on a 70B model.

export function systemPrompt(profile) {
  const list = Object.entries(profile.fields).map(([n, f]) =>
    `- ${n}: ${f.label}${f.values ? ` (one of: ${f.values.join(', ')})` : ''}`).join('\n');
  const repeat = profile.groupNote ? `\n${profile.groupNote}\n` : '\nInclude every field once.\n';
  return `${profile.task}
Propose a value ONLY if the notes state it, and copy the exact words of the notes that
state it into "quote" (verbatim, no paraphrase). If the notes do not state a value, use an
empty value and an empty quote. Do not guess.

Fields:
${list}

For each field also give:
- "speaker": ${profile.speakers}
- "certainty": "certain" if stated plainly, "uncertain" if the notes hedge (maybe, try, believes, il me semble, peut-être...)
${repeat}
Answer with JSON only, in this shape:
{"fields":[{"name":"...","value":"","quote":"","speaker":"","certainty":"certain","group":1}]}
Values in the language of the notes.`;
}

export function buildMessages(note, lang = 'en', profile) {
  return [
    { role: 'system', content: systemPrompt(profile) },
    { role: 'user', content: `Notes (${lang === 'fr' ? 'French' : 'English'}):\n"""\n${note}\n"""` }
  ];
}

/** Parse the model's answer into [{name, value, quote, speaker, certainty, group}].
 *  Tolerates code fences and a top-level object keyed by field name. */
export function parseProposal(text, profile) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[0]); } catch { return []; }
  let fields = data.fields;
  if (!Array.isArray(fields)) {
    fields = Object.entries(data).filter(([k]) => profile.fields[k]).map(([name, v]) =>
      (v && typeof v === 'object') ? { name, ...v } : { name, value: v });
  }
  return fields
    .filter((f) => f && typeof f.name === 'string')
    .map((f) => ({
      name: f.name,
      value: f.value == null ? '' : String(f.value),
      quote: f.quote == null ? '' : String(f.quote),
      speaker: f.speaker || '',
      certainty: f.certainty || '',
      ...(f.group != null ? { group: String(f.group) } : {})
    }));
}
