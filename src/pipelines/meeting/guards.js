// Meeting-notes pipeline checks. Same ideas as the field-notes checks (who did
// what, hedges kept as hedges, nothing recorded the notes do not say), applied
// to who committed to what.
import { containsPhrase, findCue, fold, words } from '../../core/text.js';
import { speakerOf } from '../../core/speakers.js';


const FIRST_PERSON = ['i', "i'll", "i'm", 'i will', 'i can', 'me', 'je', "j'", 'moi', "je m'en", 'je vais', 'je peux'];
const REPORTING = ['said', 'says', 'asked', 'suggested', 'proposed', 'wants', 'mentioned', 'thinks',
  'a dit', 'dit', 'a demande', 'demande', 'propose', 'suggere', 'veut'];

const same = (a, b) => words(a).join(' ') === words(b).join(' ');

// First person, but handing the task to someone else: "Je propose que Pierre...".
const ASSIGN_CUES = ['je propose que', 'propose que', 'je veux que', 'je voudrais que', 'il faut que',
  'i suggest', 'i propose', 'i want', 'i would like', "i'd like", 'can you', 'could you', 'please'];

// Role confusion, meeting form: the person who SPOKE or ASKED is recorded as
// the person who COMMITTED. "John: Mary will send the budget" is Mary's task.
export function ownerGuard(field, note) {
  const speaker = speakerOf(note, field.quote);
  const firstPerson = FIRST_PERSON.some((w) => containsPhrase(field.quote, w) || fold(field.quote).startsWith(`${w} `));
  if (speaker && same(speaker, field.value)) {
    const assigns = findCue(field.quote, ASSIGN_CUES);
    if (firstPerson && !assigns) return null;
    return `${field.value} is the one speaking here; the quote gives the task to someone else`;
  }
  if (REPORTING.some((v) => containsPhrase(field.quote, `${field.value} ${v}`))) {
    return `${field.value} reported or asked for this; the quote does not say ${field.value} will do it`;
  }
  if (!containsPhrase(field.quote, field.value)) return `the quote does not name ${field.value}`;
  return null;
}

export const MEETING_HEDGES = ["i'll try", 'try to', 'will try', 'might', 'maybe', 'perhaps', 'hopefully', 'probably',
  'if i can', 'if possible', 'if i have time', 'not sure', 'je vais essayer', 'essayer', 'peut etre', 'si possible',
  'si j ai le temps', 'probablement', 'pas sur', 'pas sure'];

export function meetingHedgeGuard(field) {
  if (field.certainty !== 'certain') return null;
  const cue = findCue(field.quote, MEETING_HEDGES);
  return cue ? `the notes hedge ("${cue}") but the commitment is marked certain` : null;
}

// The owner's own reply can hedge a task someone else assigned:
// "John: Mary will send it Friday." / "Mary: I'll try."
export function ownerReplyGuard(field, note) {
  for (const line of String(note).split(/\r?\n/)) {
    const m = line.match(/^\s*([^:\n]{1,40}?)\s*:\s*(.*)$/);
    if (!m || !same(m[1], field.value) || containsPhrase(line, field.quote)) continue;
    const cue = findCue(m[2], MEETING_HEDGES);
    if (cue) return `${field.value} answered "${m[2].trim()}": confirm this is a firm commitment`;
  }
  return null;
}

// A proposal recorded as a decision: the meeting form of "a hedge becomes a fact".
export const DECISION_CUES = ['agreed', 'we agree', 'decided', 'we decide', 'approved', 'confirmed', 'final', 'we keep',
  "let's go with", 'go ahead', 'on a decide', 'nous avons decide', 'decide', 'valide', 'on garde', "d'accord pour", 'adopte', 'approuve'];
export const PROPOSAL_CUES = ['could', 'should we', "let's think", 'think about', 'maybe', 'suggest', 'propose',
  'what if', 'on pourrait', 'je propose', 'peut etre', 'a voir', 'reflechir'];

export function decisionGuard(field) {
  if (findCue(field.quote, DECISION_CUES)) return null;
  const cue = findCue(field.quote, PROPOSAL_CUES);
  return cue ? `"${cue}": this was proposed, not decided` : 'the quote does not say this was decided';
}

// --- Coverage: commitments and decisions the model may have left out ---------
export const COMMITMENT_CUES = ["i'll", 'i will', 'i can', "i'm going to", 'i am going to', 'i take', 'leave it to me',
  'will send', 'will share', 'will call', 'will prepare', 'will do', 'will write',
  "je m'en occupe", 'je vais', 'je peux', "je m'engage", 'je me charge', 'je prepare', "j'envoie", "j'appelle"];

/** Lines with a commitment or decision cue that no proposed field quotes. */
export function uncoveredLines(note, proposal) {
  const quotes = proposal.map((f) => f.quote).filter((q) => q && q.trim());
  const out = [];
  for (const line of String(note).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kind = findCue(line, DECISION_CUES) ? 'decision' : findCue(line, COMMITMENT_CUES) ? 'commitment' : null;
    if (!kind) continue;
    if (quotes.some((q) => containsPhrase(line, q))) continue;
    out.push({ line: line.trim(), kind });
  }
  return out;
}
