// Meeting-notes pipeline: meeting notes become commitments and decisions.
// The door any reader walks through: everyone has received an AI summary that
// gave them a task they never took on. The checks are the same ideas as the
// protection profile: who did what (role confusion), hedges kept as hedges,
// and nothing recorded that the notes do not say.
import { meetingHedgeGuard, ownerGuard, ownerReplyGuard, decisionGuard, uncoveredLines } from './guards.js';
import { words } from '../../core/text.js';

const fields = {
  commitment_owner:  { kind: 'person', label: 'Who committed', repeatable: true },
  commitment_action: { kind: 'text',   label: 'To do what', repeatable: true },
  commitment_due:    { kind: 'phrase', label: 'By when', repeatable: true },
  decision:          { kind: 'text',   label: 'Decision', repeatable: true }
};

const has = (text, piece) => ` ${words(text).join(' ')} `.includes(` ${words(piece).join(' ')} `);

export default {
  id: 'meeting',
  label: 'Meeting notes',
  blurb: 'Who actually committed to what',
  task: 'You help a team turn meeting notes into a list of commitments and decisions.',
  speakers: 'the name of the person who said it in the notes',
  groupNote: 'Commitments repeat: give the owner, action and due date of one commitment the same "group" number (1, 2, 3...). Each decision gets its own group number too.',
  fields,

  guards(field, note) {
    const hard = [], soft = [];
    if (field.name === 'commitment_owner') { hard.push(ownerGuard(field, note)); soft.push(ownerReplyGuard(field, note)); }
    if (field.name.startsWith('commitment_')) soft.push(meetingHedgeGuard(field));
    if (field.name === 'decision') hard.push(decisionGuard(field));
    return { hard, soft };
  },

  buildRecord(accepted) {
    const groups = new Map();
    const decisions = [];
    for (const f of accepted) {
      if (f.name === 'decision') { decisions.push(f.value); continue; }
      const key = String(f.group ?? '1');
      if (!groups.has(key)) groups.set(key, {});
      groups.get(key)[f.name.replace('commitment_', '')] = f.value;
    }
    // A commitment needs both an owner and an action that passed the gate.
    const commitments = [...groups.values()].filter((c) => c.owner && c.action);
    return { commitments, decisions };
  },

  // Lines that read like a commitment or a decision but that no proposal quotes:
  // what the model may have left out. The gate cannot judge what was never
  // proposed, so it shows these lines for a person to check.
  coverage(note, proposal) {
    return uncoveredLines(note, proposal);
  },

  score(record, truth) {
    let wrong = 0, right = 0;
    const wrongList = [], missedList = [];
    const commitments = record.commitments || [], decisions = record.decisions || [];
    for (const c of commitments) {
      const ok = truth.commitments.some((t) => has(c.owner, t.owner) && has(c.action, t.action));
      if (ok) right++; else { wrong++; wrongList.push(`${c.owner}: ${c.action}`); }
    }
    for (const d of decisions) {
      const ok = truth.decisions.some((t) => has(d, t));
      if (ok) right++; else { wrong++; wrongList.push(`decision: ${d}`); }
    }
    for (const t of truth.commitments) {
      if (!commitments.some((c) => has(c.owner, t.owner) && has(c.action, t.action))) missedList.push(`${t.owner}: ${t.action}`);
    }
    for (const t of truth.decisions) {
      if (!decisions.some((d) => has(d, t))) missedList.push(`decision: ${t}`);
    }
    return { wrong, right, wrongList, missed: missedList.length, missedList };
  }
};
