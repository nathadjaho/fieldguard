import { describe, it, expect } from 'vitest';
import { runGate } from '../src/core/gate.js';
import { retryTargets, buildRetryMessages, mergeRetry } from '../src/core/retry.js';
import { retryRejected } from '../api/propose.js';
import { SCENARIOS, getPipeline } from '../src/pipelines/index.js';

const M = getPipeline('meeting');
const P = getPipeline('fieldnotes');
const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
const meeting = byId['m-en01'];
const ULTRA = 'nvidia/Nemotron-3-Ultra-550b-a55b';

// Live Nemotron Super answer, 28 Oct 2026: every field cited Mary's reply.
const reply = "I'll try, but I need the figures from David first.";
const live = [
  { name: 'commitment_owner', value: 'Mary', quote: reply, certainty: 'uncertain', group: '1' },
  { name: 'commitment_action', value: 'send the budget to the donor', quote: reply, certainty: 'uncertain', group: '1' },
  { name: 'commitment_due', value: 'by Friday', quote: reply, certainty: 'uncertain', group: '1' }
];
const answer = (fields) => JSON.stringify({ fields });

describe('second pass on refused fields', () => {
  const first = runGate(meeting.note, live, M);

  it('retries only what the gate refused', () => {
    expect(retryTargets(first).map((f) => f.name)).toEqual(['commitment_action', 'commitment_due']);
  });

  it('tells the reasoning model why each field was refused', () => {
    const [sys, user] = buildRetryMessages(meeting.note, 'en', M, retryTargets(first));
    expect(sys.content).toMatch(/refused/);
    expect(user.content).toContain('the value does not appear in its own quote');
    expect(user.content).toContain('John: Mary will send the budget');
  });

  it('accepts a corrected quote, keeps the first answer as a trace, and clears the omission flag', () => {
    const john = 'Mary will send the budget to the donor by Friday.';
    const g = mergeRetry(meeting.note, M, first, answer([
      { name: 'commitment_action', value: 'send the budget to the donor', quote: john, certainty: 'certain', group: 1 },
      { name: 'commitment_due', value: 'by Friday', quote: john, certainty: 'certain', group: 1 }
    ]), ULTRA);
    expect(g.fields.map((f) => f.status)).toEqual(['needs_confirmation', 'accepted', 'accepted']);
    expect(g.fields[1].retry).toMatchObject({ model: ULTRA, first: { quote: reply } });
    expect(g.retried).toBe(2);
    expect(g.uncovered.some((u) => /^John: Mary will send/.test(u.line))).toBe(false);
    // The owner still waits for a person, so nothing is written yet.
    expect(g.record.commitments).toEqual([]);
  });

  it('refuses a repeated bad answer again', () => {
    const g = mergeRetry(meeting.note, M, first, answer([
      { name: 'commitment_action', value: 'send the budget to the donor', quote: reply, certainty: 'certain', group: 1 }
    ]), ULTRA);
    expect(g.fields[1].status).toBe('rejected');
    expect(g.fields[1].retry).toBeTruthy();
    expect(g.fields[2].retry).toBeUndefined(); // not answered on the retry: first result stands
  });

  it('matches a retry answer by field name when the first pass had no group (live, 28 Oct)', () => {
    const s = byId.fr02;
    const note = s.note;
    const firstPass = runGate(note, [{ name: 'current_location', value: "N'Djamena", quote: 'où il travaille dans un garage', certainty: 'certain' }], P);
    const g = mergeRetry(note, P, firstPass, answer([{ name: 'current_location', value: "N'Djamena", quote: 'où il travaille dans un garage.', certainty: 'certain', group: 1 }]), ULTRA);
    const f = g.fields.find((x) => x.name === 'current_location');
    expect(f.retry).toBeTruthy();     // the second answer is judged and traced
    expect(f.status).toBe('rejected'); // and refused again: same unsupported value
  });

  it('records "not stated" when the reasoning model finds nothing', () => {
    const g = mergeRetry(meeting.note, M, first, answer([{ name: 'commitment_due', value: '', quote: '', group: 1 }]), ULTRA);
    expect(g.fields[2].status).toBe('not_stated');
  });

  it('lets a domain check win over the retry', () => {
    const s = byId.en01;
    const g1 = runGate(s.note, s.example, P);
    const cause = g1.fields.find((f) => f.name === 'injury_cause');
    expect(cause.status).toBe('rejected');
    const fixed = mergeRetry(s.note, P, g1, answer([
      { name: 'injury_cause', value: 'accident', quote: 'she hurt herself while cooking last week', certainty: 'certain' }
    ]), ULTRA);
    expect(fixed.fields.find((f) => f.name === 'injury_cause').status).toBe('accepted');
    const again = mergeRetry(s.note, P, g1, answer([
      { name: 'injury_cause', value: 'self_inflicted', quote: 'she hurt herself while cooking last week', certainty: 'certain' }
    ]), ULTRA);
    expect(again.fields.find((f) => f.name === 'injury_cause').status).toBe('rejected');
  });
});

describe('retry in the API route', () => {
  const cfg = { apiKey: 'test', baseUrl: 'http://tf', reasoningModel: ULTRA, retry: true, retryTimeoutMs: 200, thinking: false, maxTokens: 1000 };
  const first = runGate(meeting.note, live, M);
  const ok = (content) => async () => ({ ok: true, status: 200, json: async () => ({ model: ULTRA, choices: [{ message: { content } }] }) });

  it('merges the reasoning model answer', async () => {
    const john = 'Mary will send the budget to the donor by Friday.';
    const { gate, retry } = await retryRejected({ cfg, note: meeting.note, lang: 'en', profile: M, gate: first,
      fetchImpl: ok(answer([{ name: 'commitment_action', value: 'send the budget to the donor', quote: john, group: 1 }])) });
    expect(retry).toMatchObject({ model: ULTRA, fields: 2 });
    expect(gate.fields[1].status).toBe('accepted');
  });

  it('keeps the first pass when the second call fails', async () => {
    const { gate, retry } = await retryRejected({ cfg, note: meeting.note, lang: 'en', profile: M, gate: first,
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'overloaded' } }) }) });
    expect(gate).toBe(first);
    expect(retry.error).toBe('overloaded');
  });

  it('keeps the first pass when the second call is too slow', async () => {
    const slow = (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const { gate, retry } = await retryRejected({ cfg, note: meeting.note, lang: 'en', profile: M, gate: first, fetchImpl: slow });
    expect(gate).toBe(first);
    expect(retry.error).toMatch(/no answer within 200 ms/);
  });

  it('does nothing when nothing was refused, or when switched off', async () => {
    const clean = runGate(meeting.note, meeting.example.filter((f) => f.name !== 'decision' && f.value !== 'John'), M);
    expect((await retryRejected({ cfg, note: meeting.note, lang: 'en', profile: M, gate: clean })).retry).toBeNull();
    expect((await retryRejected({ cfg: { ...cfg, retry: false }, note: meeting.note, lang: 'en', profile: M, gate: first })).retry).toBeNull();
  });
});
