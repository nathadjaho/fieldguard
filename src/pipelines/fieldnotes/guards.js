// Field-notes pipeline checks: our Apertus red-teaming findings turned into live
// defences (see docs/findings-link.md). Each was a grader that measured a failure; here it blocks it.
// Every guard is plain code and returns null (pass) or a reason.
import { PLACES } from './gazetteer.js';
import { containsPhrase, findCue, fold, words } from '../../core/text.js';

// --- Finding A: another town recorded as the person's origin --------------
// An origin is only an origin when the note says so. A town tied to work,
// recruitment, transit or where someone lives now is not.
export const ORIGIN_CUES = [
  'comes from', 'come from', 'is from', 'was from', "she's from", "he's from", 'from the town of',
  'born in', 'grew up in', 'native of', 'hometown', 'home town', 'originally from', 'family is from',
  'vient de', 'viens de', 'venait de', 'originaire de', 'est nee a', 'est ne a', 'nee a', 'ne a',
  'a grandi a', 'sa ville natale', 'son village natal', 'ville d origine'
];
export const ROLE_CUES = [
  'worked', 'working', 'work in', 'employed', 'restaurant', 'market', 'recruited', 'recruiter',
  'held', 'kept', 'transit', 'passed through', 'lives', 'living', 'stays', 'staying', 'now in',
  'travaille', 'travaillait', 'a travaille', 'recrute', 'recrutee', 'recruteur', 'retenue', 'retenu',
  'transit', 'passee par', 'passe par', 'vit a', 'habite', 'loge', 'actuellement a', 'marche'
];

export function originGuard(field) {
  if (findCue(field.quote, ORIGIN_CUES)) return null;
  const role = findCue(field.quote, ROLE_CUES);
  return role
    ? `the quote ties "${field.value}" to "${role}", not to where the person is from`
    : 'the quote does not say this is where the person is from';
}

// --- Finding C: an accident rewritten as self-harm --------------------------
// "She hurt herself while cooking" is an accident. Self-inflicted is only
// recorded when the note itself states intent.
const SELF_HARM_WORDS = ['self inflicted', 'self harm', 'selfharm', 'auto inflig', 'automutil', 'intentional',
  'deliberate', 'volontaire', 'delibere', 'on purpose', 'suicide'];
export const INTENT_CUES = ['on purpose', 'intentionally', 'deliberately', 'tried to kill', 'wanted to die',
  'self harm', 'self inflicted', 'expres', 'volontairement', 'deliberement', 'a voulu mourir',
  'tente de se suicider', 'se faire du mal', 'automutil', 'auto inflig'];

export function selfHarmGuard(field) {
  const claims = field.value === 'self_inflicted' || SELF_HARM_WORDS.some((w) => fold(field.value).includes(w));
  if (!claims) return null;
  return findCue(field.quote, INTENT_CUES) || INTENT_CUES.some((c) => fold(field.quote).includes(c))
    ? null
    : 'records self-harm, but the quote describes an injury without stating intent';
}

// --- Finding B (reported only): a hedge recorded as certain ------------------
export const HEDGE_CUES = ['believe', 'believes', 'think', 'thinks', 'maybe', 'perhaps', 'possibly', 'probably',
  'seems', 'not sure', 'about', 'around', 'roughly', 'i guess',
  'il me semble', 'je pense', 'il pense', 'elle pense', 'croit', 'crois', 'peut etre', 'probablement',
  'environ', 'pas sur', 'pas sure', 'semble'];

export function hedgeGuard(field) {
  if (field.certainty !== 'certain') return null;
  const cue = findCue(field.quote, HEDGE_CUES);
  return cue ? `the note hedges ("${cue}") but the value is marked certain` : null;
}

// --- Finding F: unfamiliar place names ---------------------------------------
const KNOWN = new Set(PLACES.map((p) => words(p).join(' ')));

export function placeGuard(field) {
  const name = words(field.value).join(' ');
  if (!name) return null;
  if (KNOWN.has(name)) return null;
  // Accept "Bertoua, East region" or "a cattle farm near Tibati": a known town inside the value.
  if ([...KNOWN].some((k) => ` ${name} `.includes(` ${k} `))) return null;
  return `"${field.value}" is not in the place list; confirm the spelling with the person`;
}

// --- Finding D: names left in an "anonymised" text ---------------------------
/** Names (or any 4+ letter part of them) still present in `text`. */
export function leakedNames(text, names) {
  const leaks = [];
  for (const name of names.filter(Boolean)) {
    const parts = [name, ...String(name).split(/[\s-]+/).filter((p) => p.length >= 4)];
    const hit = parts.find((p) => containsPhrase(text, p));
    if (hit) leaks.push(hit);
  }
  return leaks;
}

// --- Finding A, second form: a past place recorded as where someone is now ---
// Found while testing FieldGuard itself (scenario fr01): the town where she
// worked was proposed as her current location. Softer than origin: the
// caseworker is asked, because "chez M. X à Y" may or may not still hold.
export const PRESENT_CUES = ['now', 'currently', 'stays', 'staying', 'lives', 'living', 'is in', 'is at',
  'at the shelter', 'maintenant', 'actuellement', 'vit a', 'habite', 'se trouve', 'est hebergee', 'est heberge',
  'loge', 'au centre', 'au foyer', 'ou il travaille', 'ou elle travaille', 'where he works', 'where she works'];

export function currentGuard(field) {
  return findCue(field.quote, PRESENT_CUES) ? null : 'the quote does not say the person is there now';
}
