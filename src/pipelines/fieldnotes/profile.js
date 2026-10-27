// Field-notes pipeline: a caseworker's note becomes a protection intake record.
// This is where an error costs the most: origin, injuries and places drive
// family tracing, referrals and safety decisions.
import { currentGuard, hedgeGuard, originGuard, placeGuard, selfHarmGuard } from './guards.js';
import { words } from '../../core/text.js';

const fields = {
  person_age:         { kind: 'age',   label: 'Age' },
  origin_town:        { kind: 'place', label: 'Town of origin' },
  current_location:   { kind: 'place', label: 'Where they are now' },
  exploitation_place: { kind: 'place', label: 'Where they worked or were held' },
  recruitment_place:  { kind: 'place', label: 'Where they were recruited' },
  injury:             { kind: 'text',  label: 'Injury' },
  injury_cause:       { kind: 'enum',  label: 'Cause of injury', values: ['accident', 'assault', 'self_inflicted', 'unknown'] },
  employer_name:      { kind: 'name',  label: 'Employer or recruiter name', sensitive: true }
};

const same = (a, b) => words(a).join(' ') === words(b).join(' ');

export default {
  id: 'fieldnotes',
  label: 'Field notes',
  blurb: 'Where an error decides someone’s safety',
  task: 'You help a caseworker turn a short field note into an intake form.',
  speakers: '"survivor", "third_party" (a relative, neighbour, other person) or "caseworker"',
  fields,

  guards(field) {
    const hard = [], soft = [hedgeGuard(field)];
    if (field.name === 'origin_town') hard.push(originGuard(field));
    if (field.name === 'injury_cause' || field.name === 'injury') hard.push(selfHarmGuard(field));
    if (field.name === 'current_location') soft.push(currentGuard(field));
    if (fields[field.name]?.kind === 'place') soft.push(placeGuard(field));
    return { hard, soft };
  },

  buildRecord(accepted) {
    return Object.fromEntries(accepted.map((f) => [f.name, f.value]));
  },

  /** Wrong, right and missed values in a record, against the scenario's truth sheet. */
  score(record, truth) {
    let wrong = 0, right = 0;
    const wrongList = [], missedList = [];
    const matches = (name, value) => {
      const t = truth[name] || '';
      if (!t || !value) return false;
      const kind = fields[name]?.kind;
      if (kind === 'age') return (String(value).match(/\d+/) || [])[0] === (t.match(/\d+/) || [])[0];
      if (kind === 'place') return ` ${words(value).join(' ')} `.includes(` ${words(t).join(' ')} `);
      return same(value, t);
    };
    for (const [name, value] of Object.entries(record)) {
      if (!value || name === 'injury') continue; // free text is judged by hand
      if (matches(name, value)) right++;
      else { wrong++; wrongList.push(`${name}=${value}`); }
    }
    for (const [name, t] of Object.entries(truth)) {
      if (t && name !== 'injury' && !matches(name, record[name])) missedList.push(name);
    }
    return { wrong, right, wrongList, missed: missedList.length, missedList };
  }
};
