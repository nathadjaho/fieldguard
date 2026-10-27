// Measures what the gate buys: runs every invented scenario through Nemotron,
// then counts wrong values that would reach the record WITHOUT the gate
// (everything the model proposes) and WITH it (accepted fields only).
//
//   npm run eval              live calls (needs NEBIUS_API_KEY in .env), answers cached in eval/out/
//   npm run eval -- --replay  re-score the cached answers, no network
//   npm run eval -- --example score the hand-written examples (no key, no network)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { SCENARIOS, getPipeline } from '../src/pipelines/index.js';
import { runGate, recordWithoutGate } from '../src/core/gate.js';
import { buildMessages, parseProposal } from '../src/core/prompt.js';
import { chat, config } from '../api/_lib/tokenfactory.js';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
process.on('unhandledRejection', (e) => { console.error('eval stopped: ' + (e?.message || e)); process.exit(1); });
const mode = process.argv.includes('--example') ? 'example' : process.argv.includes('--replay') ? 'replay' : 'live';
const OUT = 'eval/out';
mkdirSync(OUT, { recursive: true });
const cfg = config();

async function proposalFor(s, profile) {
  if (mode === 'example') return { proposal: s.example, model: 'hand-written example' };
  const file = `${OUT}/${s.id}.json`;
  if (mode === 'replay') {
    if (!existsSync(file)) throw new Error(`no cached answer for ${s.id}; run without --replay first`);
    const c = JSON.parse(readFileSync(file, 'utf8'));
    return { proposal: parseProposal(c.text, profile), model: c.model };
  }
  const answer = await chat({ ...cfg, model: cfg.fastModel, messages: buildMessages(s.note, s.lang, profile) });
  writeFileSync(file, JSON.stringify({ id: s.id, model: answer.model, text: answer.text, finish_reason: answer.finishReason, usage: answer.usage, at: new Date().toISOString() }, null, 2));
  return { proposal: parseProposal(answer.text, profile), model: answer.model };
}

const totals = { without: 0, with: 0, keptRight: 0, proposedRight: 0, omitted: 0, flagged: 0 };
console.log(`FieldGuard eval · mode=${mode}\n`);
for (const s of SCENARIOS) {
  const profile = getPipeline(s.profile);
  let got;
  try { got = await proposalFor(s, profile); } catch (e) {
    console.log(`${s.id} [${profile.id}] ERROR ${e.message}`);
    totals.errors = (totals.errors || 0) + 1;
    continue;
  }
  const { proposal, model } = got;
  if (!proposal.length) { console.log(`${s.id} [${profile.id}] (${model}) no fields parsed from the answer`); totals.errors = (totals.errors || 0) + 1; continue; }
  const gate = runGate(s.note, proposal, profile);
  const a = profile.score(recordWithoutGate(proposal, profile), s.truth);
  const b = profile.score(gate.record, s.truth);
  totals.without += a.wrong; totals.with += b.wrong; totals.proposedRight += a.right; totals.keptRight += b.right;
  totals.omitted += a.missed; totals.flagged += gate.uncovered.length;
  console.log(`${s.id} [${profile.id}] (${model})`);
  console.log(`  without gate: ${a.wrong} wrong  ${a.wrongList.join(', ')}`);
  console.log(`  with gate:    ${b.wrong} wrong  ${b.wrongList.join(', ')}  · ${gate.summary.needs_confirmation} to confirm, ${gate.summary.rejected} rejected`);
  if (a.missed) console.log(`  missing or wrong in the proposal: ${a.missedList.join(', ')}`);
  if (gate.uncovered.length) console.log(`  flagged as possibly missed: ${gate.uncovered.map((u) => `"${u.line}"`).join(' ')}`);
}
if (totals.errors) console.log(`\n${totals.errors} scenario(s) without a usable answer, not counted below.`);
console.log(`\nWrong values reaching the record: ${totals.without} without the gate, ${totals.with} with it.`);
console.log(`Truth values missing or wrong in the model's proposals: ${totals.omitted}. Lines flagged by the coverage check as possibly missed: ${totals.flagged}.`);
console.log(`Correct values written: ${totals.proposedRight} proposed, ${totals.keptRight} accepted directly (the rest wait for confirmation).`);
