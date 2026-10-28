import { describe, it, expect } from 'vitest';
import { runGate, judgeField, recordWithoutGate } from '../src/core/gate.js';
import { getPipeline as getProfile, SCENARIOS } from '../src/pipelines/index.js';
import { leakedNames } from '../src/pipelines/fieldnotes/guards.js';
import { parseProposal } from '../src/core/prompt.js';

const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
const P = getProfile('fieldnotes');
const M = getProfile('meeting');
const statusOf = (id) => {
  const s = byId[id];
  const g = runGate(s.note, s.example, getProfile(s.profile));
  return Object.fromEntries(g.fields.map((f) => [f.name, f.status]));
};

describe('gate on the hand-written examples', () => {
  it('en01: rejects the workplace town as origin and the kitchen burn as self-harm', () => {
    const st = statusOf('en01');
    expect(st.origin_town).toBe('rejected');
    expect(st.injury_cause).toBe('rejected');
    expect(st.person_age).toBe('needs_confirmation'); // "thinks ... about 16" marked certain
    expect(st.exploitation_place).toBe('accepted');
    expect(st.recruitment_place).toBe('accepted');
    expect(st.employer_name).toBe('accepted');
  });

  it('fr01: accepts a stated origin, rejects "auto-infligée" for a fall, catches the wrong current location', () => {
    const st = statusOf('fr01');
    expect(st.origin_town).toBe('accepted');
    expect(st.injury).toBe('rejected');
    expect(st.injury_cause).toBe('rejected');
    expect(st.person_age).toBe('needs_confirmation');
    expect(st.recruitment_place).toBe('not_stated');
    expect(st.current_location).toBe('needs_confirmation'); // workplace, not "now"
  });

  it('en02: asks to confirm an unfamiliar town, rejects a quote that is not in the note', () => {
    const st = statusOf('en02');
    expect(st.origin_town).toBe('needs_confirmation');
    expect(st.current_location).toBe('rejected');
    expect(st.exploitation_place).toBe('accepted');
  });

  it('fr02: rejects a transit town recorded as origin', () => {
    const st = statusOf('fr02');
    expect(st.origin_town).toBe('rejected');
    // "avant d'arriver à N'Djamena" says he arrived, not that he is there now: ask.
    expect(st.current_location).toBe('needs_confirmation');
    expect(st.exploitation_place).toBe('accepted');
  });

  it('the record only ever holds accepted fields', () => {
    for (const s of SCENARIOS.filter((x) => x.profile === 'fieldnotes')) {
      const g = runGate(s.note, s.example, P);
      const accepted = g.fields.filter((f) => f.status === 'accepted').map((f) => f.name).sort();
      expect(Object.keys(g.record).sort()).toEqual(accepted);
    }
  });

  it('no accepted field disagrees with the truth sheet', () => {
    for (const s of SCENARIOS.filter((x) => x.profile === 'fieldnotes')) {
      const g = runGate(s.note, s.example, P);
      for (const [name, value] of Object.entries(g.record)) {
        expect(s.truth[name], `${s.id}.${name}`).not.toBe('');
        if (name !== 'injury') expect(value, `${s.id}.${name}`).toBe(s.truth[name]);
      }
    }
  });
});

describe('single-field rules', () => {
  const note = 'She says she comes from Bertoua. She hurt herself on purpose last month.';
  it('accepts self-harm only when the note states intent', () => {
    expect(judgeField(note, { name: 'injury_cause', value: 'self_inflicted', quote: 'She hurt herself on purpose last month', certainty: 'certain' }, P).status).toBe('accepted');
  });
  it('rejects an unknown field and a value missing from its quote', () => {
    expect(judgeField(note, { name: 'religion', value: 'x', quote: 'She says' }, P).status).toBe('rejected');
    expect(judgeField(note, { name: 'origin_town', value: 'Douala', quote: 'she comes from Bertoua' }, P).status).toBe('rejected');
  });
  it('treats an empty or "unknown" value as not stated', () => {
    expect(judgeField(note, { name: 'origin_town', value: 'Unknown', quote: '' }, P).status).toBe('not_stated');
  });
});

describe('field-notes scoring', () => {
  it('compares ages by number, so "about 16" counts as 16', () => {
    const sc = P.score({ person_age: 'about 16' }, byId.en01.truth);
    expect(sc.wrong).toBe(0);
    expect(sc.right).toBe(1);
  });
});

describe('anonymisation check (finding D)', () => {
  it('finds a surname left in a referral', () => {
    expect(leakedNames('Her employer, Mr Dupont, kept her papers.', ['Pierre Dupont'])).toEqual(['Dupont']);
    expect(leakedNames('Her employer kept her papers.', ['Pierre Dupont'])).toEqual([]);
  });
});

describe('parseProposal', () => {
  it('reads fenced JSON and the keyed shape', () => {
    expect(parseProposal('```json\n{"fields":[{"name":"origin_town","value":"Kribi","quote":"from Kribi"}]}\n```')[0].value).toBe('Kribi');
    expect(parseProposal('{"origin_town":{"value":"Kribi","quote":"from Kribi"}}', P)[0].name).toBe('origin_town');
    expect(parseProposal('no json')).toEqual([]);
  });
});

describe('meeting profile', () => {
  const s = byId['m-en01'];
  const judge = (f) => judgeField(s.note, { speaker: '', certainty: 'certain', ...f }, M);

  it('m-en01: rejects the speaker as owner and a suggestion as a decision', () => {
    const g = runGate(s.note, s.example, M);
    expect(g.record.commitments).toEqual([{ owner: 'David', action: 'Share the figures', due: 'tomorrow morning' }]);
    expect(g.record.decisions).toEqual(['Keep the training on 12 November']);
    expect(M.score(g.record, s.truth).wrong).toBe(0);
    expect(M.score(recordWithoutGate(s.example, M), s.truth).wrong).toBe(2);
  });

  it('asks to confirm a task its owner answered with "I\'ll try"', () => {
    const r = judge({ name: 'commitment_owner', value: 'Mary', quote: 'Mary will send the budget to the donor by Friday' });
    expect(r.status).toBe('needs_confirmation');
    expect(r.reasons[0]).toMatch(/Mary answered/);
  });

  it('accepts a first-person commitment through the line speaker', () => {
    expect(judge({ name: 'commitment_owner', value: 'David', quote: 'I can share the figures tomorrow morning' }).status).toBe('accepted');
  });

  it('m-fr01: rejects "je propose que Pierre..." recorded as Sophie\'s task, and keeps "peut-être" uncertain', () => {
    const f = byId['m-fr01'];
    const g = runGate(f.note, f.example, M);
    const st = g.fields.map((x) => `${x.name}:${x.value}:${x.status}`);
    expect(st).toContain('commitment_owner:Sophie:rejected');
    expect(st).toContain('commitment_owner:Marc:needs_confirmation');
    expect(g.record.decisions).toEqual(['Garder le budget actuel']);
  });

  it('flags commitment and decision lines that no proposal quotes', () => {
    const onlyMary = [{ name: 'commitment_owner', value: 'Mary', quote: 'Mary will send the budget to the donor by Friday', certainty: 'uncertain', group: '1' }];
    const g = runGate(s.note, onlyMary, M);
    expect(g.uncovered.map((u) => u.kind)).toEqual(['commitment', 'commitment', 'decision']);
    expect(g.uncovered[0].line).toMatch(/^Mary: I'll try/);
    expect(g.uncovered[2].line).toMatch(/^Sarah: Agreed/);
    // A suggestion ("we could") is not flagged as a missed decision.
    expect(g.uncovered.some((u) => /could/.test(u.line))).toBe(false);
  });

  // Live Nemotron answer, 28 Oct 2026: every field cited Mary's reply.
  it('rejects a task its quote does not contain, and asks a person about an uncertain owner', () => {
    const reply = "I'll try, but I need the figures from David first.";
    const live = [
      { name: 'commitment_owner', value: 'Mary', quote: reply, certainty: 'uncertain', group: '1' },
      { name: 'commitment_action', value: 'send the budget to the donor', quote: reply, certainty: 'uncertain', group: '1' },
      { name: 'commitment_due', value: 'by Friday', quote: reply, certainty: 'uncertain', group: '1' }
    ];
    const g = runGate(s.note, live, M);
    expect(g.fields.map((f) => f.status)).toEqual(['needs_confirmation', 'rejected', 'rejected']);
    expect(g.record.commitments).toEqual([]);
    expect(g.uncovered[0].line).toMatch(/^John: Mary will send/);
  });

  it('accepts free text whose words are in its quote, even lightly reworded', () => {
    expect(judge({ name: 'commitment_action', value: 'Send the budgets to the donor', quote: 'Mary will send the budget to the donor by Friday' }).status).toBe('accepted');
    expect(judge({ name: 'decision', value: 'Keep the training on 12 November', quote: 'Agreed, we keep the training on 12 November' }).status).toBe('accepted');
  });

  it('scores omissions against the truth sheet', () => {
    const sc = M.score({ commitments: [{ owner: 'Mary', action: 'send the budget' }], decisions: [] }, s.truth);
    expect(sc.missedList).toEqual(['David: figures', 'decision: training on 12 November']);
  });

  it('keeps commitments apart by group', () => {
    const rec = M.buildRecord([
      { name: 'commitment_owner', value: 'A', group: '1' }, { name: 'commitment_action', value: 'x', group: '1' },
      { name: 'commitment_owner', value: 'B', group: '2' }
    ]);
    expect(rec.commitments).toEqual([{ owner: 'A', action: 'x' }]);
  });
});
