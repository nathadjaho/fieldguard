// The before/after table shown on the page. It replays the Nemotron answers
// recorded by `npm run eval` (eval/out/*.json) through the same gate, in the
// browser: no model call, and the numbers are the ones in the README.
import { runGate, recordWithoutGate } from './core/gate.js';
import { mergeRetry } from './core/retry.js';
import { parseProposal } from './core/prompt.js';
import { SCENARIOS, getPipeline } from './pipelines/index.js';

const recorded = import.meta.glob('../eval/out/*.json', { eager: true, import: 'default' });

export function evidence() {
  const rows = [];
  for (const s of SCENARIOS) {
    const answer = recorded[`../eval/out/${s.id}.json`];
    if (!answer?.text) continue;
    const profile = getPipeline(s.profile);
    const proposal = parseProposal(answer.text, profile);
    const first = runGate(s.note, proposal, profile);
    const gate = answer.retry ? mergeRetry(s.note, profile, first, answer.retry.text, answer.retry.model) : first;
    const before = profile.score(recordWithoutGate(proposal, profile), s.truth);
    const after = profile.score(gate.record, s.truth);
    rows.push({
      id: s.id,
      title: s.title,
      pipeline: profile.label,
      lang: s.lang,
      model: answer.model,
      at: answer.at,
      tokens: (answer.usage?.total_tokens || 0) + (answer.retry?.usage?.total_tokens || 0),
      wrongBefore: before.wrong,
      wrongAfter: after.wrong,
      refused: gate.summary.rejected,
      // Second pass: refused on the first pass, and how many the reasoning model then fixed.
      firstRefused: first.summary.rejected,
      fixed: gate.fields.filter((f) => f.retry && f.status !== 'rejected').length,
      retryModel: answer.retry?.model,
      toConfirm: gate.summary.needs_confirmation,
      // Meeting pipeline only: items the model left out, and lines the coverage check flagged.
      omitted: s.profile === 'meeting' ? before.missed : null,
      flagged: s.profile === 'meeting' ? gate.uncovered.length : null
    });
  }
  const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  return {
    rows,
    model: rows[0]?.model,
    retryModel: rows.find((r) => r.retryModel)?.retryModel,
    date: rows[0]?.at?.slice(0, 10),
    totals: {
      notes: rows.length,
      wrongBefore: sum('wrongBefore'),
      wrongAfter: sum('wrongAfter'),
      refused: sum('refused'),
      firstRefused: sum('firstRefused'),
      fixed: sum('fixed'),
      toConfirm: sum('toConfirm'),
      omitted: sum('omitted'),
      flagged: sum('flagged'),
      tokens: sum('tokens')
    }
  };
}
