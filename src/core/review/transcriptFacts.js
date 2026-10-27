// Copied from TRACE (github.com/ElkeDikoume/trace-humanitarian, src/v2/lib/transcriptFacts.js).
// Copyright (c) 2026 Elke-Esmeralda Dikoume. Contributed to FieldGuard under the
// Apache License 2.0 with the author's permission. Unchanged apart from this header.

// Finds the facts in a machine transcript that a caseworker has to confirm one
// by one before the draft can be saved: numbers, dates, times and ages.
//
// WHY THIS EXISTS. Speech-to-text was measured on 5 Oct 2026 (research branch
// research/google-speech-audio-only-languages, research/google-speech-test/).
// Transcripts scored 96 to 99% correct by characters and still lost the facts a
// caseworker acts on: "150000" came back as "1500", in the right script, so a
// skimming reader would pass it. Character error rate measures letters; a
// caseworker acts on facts. The proposed rule is that a machine transcript is a
// draft, and every numeral, date and age in it is confirmed individually.
//
// SO THIS ERRS TOWARD FLAGGING. A false positive costs the caseworker one tap.
// A miss saves a wrong head count or age into a case record. Where a word is
// ambiguous (Spanish "once" is eleven and English "once" is not; "mañana" is
// tomorrow and morning) it is flagged, unless the caller passes `langs` to
// narrow the vocabulary. The one deliberate exception is a lone French or Spanish
// indefinite article ("un", "une", "una"), which would otherwise mark nearly
// every sentence; inside a longer number ("vingt et un") it still counts.
//
// Spelled-out numbers are recognised in English, French and Spanish. That is a
// statement about this detector, not about which languages TRACE captures: that
// list lives in the code and is printed by `npm run languages`.
//
// Pure functions only. No speech service is called from here or anywhere this
// is used; see TranscriptDraftReview.jsx.

// 'place' is a location phrase built round a place word ("transit point",
// "camp", "río"). 'name' is a capitalised name that may be a place or a person;
// a detector without a gazetteer cannot tell which, so it asks rather than
// guesses. Both were added on 5 Oct 2026, because the acceptance rule's three
// critical slots are location, headcount and age, and a location is the one
// the research saw dropped outright ("near the river").
export const FACT_KINDS = ['number', 'date', 'time', 'age', 'place', 'name'];

// Lowercase and drop accents, so "dieciséis" and "dieciseis", "millón" and
// "millon", "février" and "fevrier" are one word. NFD splits a letter from its
// accent without changing the number of base letters, which is all we need:
// offsets are always taken from the original text, never from this.
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const NUMBER_WORDS = {
  en: [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
    'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
    'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'dozen', 'dozens'
  ],
  fr: [
    'zero', 'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'vingts', 'trente',
    'quarante', 'cinquante', 'soixante', 'cent', 'cents', 'mille', 'million', 'millions',
    'milliard', 'milliards', 'dizaine', 'dizaines', 'douzaine', 'douzaines', 'quinzaine',
    'vingtaine', 'trentaine', 'quarantaine', 'cinquantaine', 'centaine', 'centaines', 'millier', 'milliers'
  ],
  es: [
    'cero', 'un', 'uno', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho',
    'diecinueve', 'veinte', 'veintiun', 'veintiuno', 'veintiuna', 'veintidos', 'veintitres',
    'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve',
    'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien',
    'ciento', 'cientos', 'doscientos', 'doscientas', 'trescientos', 'trescientas',
    'cuatrocientos', 'cuatrocientas', 'quinientos', 'quinientas', 'seiscientos', 'seiscientas',
    'setecientos', 'setecientas', 'ochocientos', 'ochocientas', 'novecientos', 'novecientas',
    'mil', 'miles', 'millon', 'millones', 'docena', 'docenas', 'decena', 'decenas', 'centenar', 'centenares'
  ]
};

// Words that join two number words inside one number: "one hundred and fifty",
// "vingt et un", "treinta y dos". Only ever absorbed between number words.
const CONNECTORS = { en: ['and'], fr: ['et'], es: ['y'] };

// Words that can follow a digit and belong to it: "2 million", "150 mil".
const SCALES = new Set(['hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion',
  'cent', 'cents', 'mille', 'milliard', 'milliards', 'cien', 'ciento', 'mil', 'millon', 'millones']);

// A lone article is not flagged. See the header.
const LONE_ARTICLES = new Set(['un', 'une', 'una']);

const MONTHS = {
  en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
    'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
    'sept', 'oct', 'nov', 'dec'],
  fr: ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre',
    'octobre', 'novembre', 'decembre'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
    'setiembre', 'octubre', 'noviembre', 'diciembre']
};
// Month words that are also ordinary words or abbreviations: "may" the verb,
// "mar" the Spanish sea. These count as a date only next to a number.
const AMBIGUOUS_MONTHS = new Set(['may', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
  'sept', 'oct', 'nov', 'dec', 'mai']);

const DAY_WORDS = {
  en: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'yesterday', 'today', 'tomorrow', 'tonight'],
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
    'hier', "aujourd'hui", 'aujourd’hui', 'demain', 'avant-hier', 'apres-demain'],
  es: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
    'ayer', 'hoy', 'manana', 'anoche', 'anteayer', 'pasado']
};

const TIME_WORDS = {
  en: ['noon', 'midnight', 'midday'],
  fr: ['midi', 'minuit'],
  es: ['mediodia', 'medianoche']
};

const LANGS = ['en', 'fr', 'es'];

// Which languages' word lists to use. Field speech code-switches (Lingala
// intake full of French numbers, Hausa full of English ones), so a caller
// passes a SET: the capture language plus the region's lingua franca. Codes
// outside en/fr/es contribute nothing; if none of the set is covered, only
// digits, numeric dates and clock times are found, never a guess from another
// language's vocabulary. With no set at all, all three are used.
const normaliseLangs = (opts = {}) => {
  const raw = opts.langs ?? (opts.lang ? [opts.lang] : null);
  if (!raw) return null;
  return [...new Set(raw.filter(Boolean).map((l) => String(l).toLowerCase().split(/[-_]/)[0]))];
};

/**
 * Which of `langs` this detector can read spelled-out numbers in.
 * `uncovered` non-empty means a number said as words in one of those languages
 * will not be highlighted, and the review has to say so.
 */
export function spelledNumberCoverage(langs) {
  const set = normaliseLangs({ langs }) ?? LANGS;
  return { covered: set.filter((l) => LANGS.includes(l)), uncovered: set.filter((l) => !LANGS.includes(l)) };
}

function vocabulary(set) {
  const langs = set ? set.filter((l) => LANGS.includes(l)) : LANGS;
  const pick = (table) => new Set(langs.flatMap((l) => table[l]));
  const days = pick(DAY_WORDS);
  // "pasado" is only a date as part of "pasado mañana"; on its own it is "past".
  days.delete('pasado');
  return {
    numbers: pick(NUMBER_WORDS),
    connectors: pick(CONNECTORS),
    months: pick(MONTHS),
    days,
    times: pick(TIME_WORDS),
    places: pick(PLACE_WORDS)
  };
}

// Words with their offsets in the original text. Apostrophes and hyphens stay
// inside a word so "aujourd'hui", "twenty-one" and "quatre-vingt-dix" are one.
function tokenize(text) {
  const out = [];
  const re = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
  let m;
  while ((m = re.exec(text))) {
    out.push({ text: m[0], folded: fold(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const isDigits = (s) => /^\d+$/.test(s);

function isNumberWord(folded, v) {
  if (v.numbers.has(folded)) return true;
  // Hyphenated compounds: every part must be a number word or a connector
  // ("vingt-et-un"), and at least one part a number word.
  if (folded.includes('-')) {
    const parts = folded.split('-');
    return parts.every((p) => v.numbers.has(p) || v.connectors.has(p)) && parts.some((p) => v.numbers.has(p));
  }
  return false;
}

// Only whitespace between two tokens? Used to keep a phrase from jumping a
// comma or a full stop.
const adjacent = (text, a, b) => /^\s+$/.test(text.slice(a.end, b.start));

// Digits, with thousands separators that a recognizer or a person might write:
// "2,400", "2.400", "2 400" (French, with an ordinary or a narrow no-break
// space), and decimals. A space only counts as a separator when exactly three
// digits follow it, so "aged 3 12 children" stays two numbers.
const DIGIT_RE = /\d+(?:(?:[,.]|[   ](?=\d{3}(?!\d)))\d{3}(?!\d))*(?:[.,]\d+)?\s?%?/gu;

function digitSpans(text) {
  const out = [];
  let m;
  DIGIT_RE.lastIndex = 0;
  while ((m = DIGIT_RE.exec(text))) {
    // Never end a span on the optional space before a "%" that was not there.
    const s = m[0].replace(/\s+$/, '');
    out.push({ start: m.index, end: m.index + s.length, kind: 'number' });
  }
  return out;
}

function spelledSpans(text, tokens, v) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isNumberWord(tokens[i].folded, v)) { i += 1; continue; }
    let j = i;
    // Extend over further number words, and over a connector only when another
    // number word follows it.
    for (;;) {
      const next = tokens[j + 1];
      if (next && adjacent(text, tokens[j], next) && isNumberWord(next.folded, v)) { j += 1; continue; }
      const after = tokens[j + 2];
      if (next && after && v.connectors.has(next.folded) && adjacent(text, tokens[j], next)
        && adjacent(text, next, after) && isNumberWord(after.folded, v)) { j += 2; continue; }
      break;
    }
    const lone = i === j && LONE_ARTICLES.has(tokens[i].folded);
    if (!lone) out.push({ start: tokens[i].start, end: tokens[j].end, kind: 'number' });
    i = j + 1;
  }
  return out;
}

// "2 million", "150 mil", "3 mille": a digit followed by a scale word is one
// number, not two.
function joinDigitScales(text, spans, tokens) {
  return spans.map((s) => {
    const next = tokens.find((t) => t.start >= s.end);
    if (next && /^\s+$/.test(text.slice(s.end, next.start)) && SCALES.has(next.folded) && /\d$/.test(text.slice(s.start, s.end))) {
      return { ...s, end: next.end };
    }
    return s;
  });
}

// Grow a number span into an age or a time from the words around it. The
// patterns are anchored to the span's edges, so they cannot reach across a
// sentence.
const AGE_AFTER = /^(?:[\s-]*(?:years?|yrs?)[\s-]*old\b|[\s-]+years?\s+of\s+age\b|[\s-]+(?:months?|weeks?)[\s-]*old\b)/iu;
const AGE_UNIT_FR_ES = /^\s+(?:ans|an|mois|años|año|anos|ano|meses|mes)\b/iu;
const AGE_PREFIX_FR = /(?:\bâgée?s?\s+de\s+|\b(?:a|ont|avait|avaient)\s+|\bedad\s+de\s+|\b(?:tiene|tienen|tenía|tenia|de)\s+)$/iu;
const AGE_PREFIX_EN = /(?:\b(?:aged|age|ages)\s+|\bage\s+of\s+)$/iu;

const TIME_AFTER = /^(?:\s?(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![\p{L}])|\s+o['’]clock\b|\s*h\s*\d{2}\b|\s*h(?![\p{L}])|\s+heures?\b|\s+horas?\b)/iu;
const TIME_BEFORE = /(?:\ba\s+las?\s+|\bà\s+(?=\S+\s+heures?))$/iu;

function growNumber(text, span) {
  const before = text.slice(Math.max(0, span.start - 40), span.start);
  const after = text.slice(span.end, span.end + 40);

  let m = after.match(AGE_AFTER);
  if (m) {
    const pre = before.match(AGE_PREFIX_EN);
    return { start: pre ? span.start - pre[0].length : span.start, end: span.end + m[0].length, kind: 'age' };
  }
  m = after.match(AGE_UNIT_FR_ES);
  if (m) {
    const pre = before.match(AGE_PREFIX_FR);
    // "il a 12 ans", "âgée de 12 ans", "de doce años", "tiene 7 años" are ages.
    // "pendant 3 ans", "durante dos años" are durations: still a number to confirm.
    if (pre) return { start: span.start, end: span.end + m[0].length, kind: 'age' };
    return span;
  }
  const pre = before.match(AGE_PREFIX_EN);
  if (pre) return { start: span.start - pre[0].length, end: span.end, kind: 'age' };

  m = after.match(TIME_AFTER);
  if (m) {
    const lead = before.match(TIME_BEFORE);
    return { start: lead ? span.start - lead[0].length : span.start, end: span.end + m[0].length, kind: 'time' };
  }
  const lead = before.match(/\ba\s+las?\s+$/iu);
  if (lead) return { start: span.start - lead[0].length, end: span.end, kind: 'time' };
  return span;
}

// Dates and times written as digits with separators. Run before plain digits
// so "12/03/2026" is one date, not three numbers.
const NUMERIC_DATE_RE = /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/gu;
const CLOCK_RE = /\b\d{1,2}[:h]\d{2}(?:\s?(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![\p{L}]))?/giu;

function regexSpans(text, re, kind) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, kind });
  return out;
}

// A month name pulls in the day before or after it and a year after it:
// "3 March 2026", "March 3rd, 2026", "le 3 mars", "3 de marzo de 2026",
// "the third of March". Weekdays and "yesterday" / "hier" / "ayer" stand alone.
function wordDateSpans(text, tokens, numberSpans, v) {
  const out = [];
  const numberEndingAt = (pos) => numberSpans.find((s) => s.end === pos);

  tokens.forEach((tok, i) => {
    if (v.days.has(tok.folded)) {
      // "pasado mañana" is one date.
      const prev = tokens[i - 1];
      const start = prev && prev.folded === 'pasado' && adjacent(text, prev, tok) ? prev.start : tok.start;
      out.push({ start, end: tok.end, kind: 'date' });
      return;
    }
    if (v.times.has(tok.folded)) { out.push({ start: tok.start, end: tok.end, kind: 'time' }); return; }
    if (!v.months.has(tok.folded)) return;

    let start = tok.start;
    let end = tok.end;
    let anchored = false;

    // Day before: "3 March", "3rd March", "3 de marzo", "third of March".
    const beforeText = text.slice(Math.max(0, tok.start - 30), tok.start);
    const dayBefore = beforeText.match(/(\d{1,2})(?:st|nd|rd|th|er|re|º)?\s+(?:(?:de|of)\s+)?$/iu);
    if (dayBefore) { start = tok.start - dayBefore[0].length; anchored = true; } else {
      const linker = beforeText.match(/\s+(?:(?:de|of)\s+)?$/iu);
      const n = linker && numberEndingAt(tok.start - linker[0].length);
      if (n) { start = n.start; anchored = true; }
    }
    // Day after: "March 3", "March 3rd".
    const afterText = text.slice(tok.end, tok.end + 30);
    const dayAfter = !anchored && afterText.match(/^\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*[:h]\d)/iu);
    if (dayAfter && Number(dayAfter[1]) <= 31) { end = tok.end + dayAfter[0].length; anchored = true; }
    // Year after: "March 2026", "3 March, 2026", "3 de marzo de 2026".
    const rest = text.slice(end, end + 30);
    const year = rest.match(/^,?\s+(?:de\s+)?(\d{4})\b/iu);
    if (year) { end += year[0].length; anchored = true; }

    if (!anchored && AMBIGUOUS_MONTHS.has(tok.folded)) return;
    out.push({ start, end, kind: 'date' });
  });
  return out;
}

// ── Places ────────────────────────────────────────────────────────────────
//
// No gazetteer, deliberately: the places that matter in a field note are the
// ones no list has (a coined transit point, "the water point near the river").
// Two signals instead, both erring toward flagging:
//
//   1. a PLACE WORD (camp, village, river, school...) with the words that
//      qualify it on either side: "Kurmadi transit point", "point de transit
//      de Kurmadi", "the water point near the river";
//   2. a CAPITALISED NAME in the middle of a sentence. This works in any
//      language written in Latin script with capitals, Hausa and Somali
//      included. It cannot work in Arabic or Ge'ez script, which have no
//      capitals, so those languages get the read-through, not a promise.
//
// "point", "post" and "station" are places only with a qualifier ("transit
// point", "health post"); "at this point" is not a location.
const PLACE_WORDS = {
  en: ['camp', 'camps', 'village', 'villages', 'town', 'city', 'river', 'school', 'clinic', 'hospital',
    'market', 'border', 'bridge', 'road', 'borehole', 'settlement', 'district', 'site', 'centre', 'center',
    'wadi', 'valley', 'mountain', 'church', 'mosque', 'point', 'post', 'station'],
  fr: ['camp', 'camps', 'village', 'villages', 'ville', 'riviere', 'fleuve', 'ecole', 'clinique', 'hopital',
    'frontiere', 'pont', 'route', 'puits', 'quartier', 'site', 'centre', 'oued', 'vallee', 'eglise',
    'mosquee', 'point', 'poste'],
  es: ['campamento', 'campamentos', 'aldea', 'pueblo', 'ciudad', 'rio', 'escuela', 'clinica', 'hospital',
    'mercado', 'frontera', 'puente', 'carretera', 'pozo', 'barrio', 'sitio', 'centro', 'valle', 'iglesia',
    'mezquita', 'punto', 'puesto']
};
const NEEDS_QUALIFIER = new Set(['point', 'post', 'station', 'poste', 'punto', 'puesto']);
// Words that qualify a place word from the left in English ("water point").
const PLACE_QUALIFIERS_EN = new Set(['water', 'transit', 'distribution', 'health', 'border', 'refugee',
  'reception', 'collection', 'crossing', 'entry', 'displacement', 'idp', 'police', 'bus', 'food',
  'primary', 'secondary', 'main', 'nutrition', 'registration', 'meeting', 'way', 'feeding']);
// Words that qualify it from the right after "de" in French and Spanish
// ("point de transit", "punto de agua").
const PLACE_QUALIFIERS_FR_ES = new Set(['transit', 'eau', 'distribution', 'sante', 'passage', 'accueil',
  'enregistrement', 'transito', 'agua', 'distribucion', 'salud', 'acogida', 'registro', 'entrega',
  'refugies', 'refugiados', 'deplaces', 'desplazados']);
// The join between two place phrases that makes them one location.
const PLACE_RELATION = /^\s+(?:near|by|beside|behind|opposite|next\s+to|close\s+to|pr[eè]s\s+d[eu]|(?:pr[eè]s\s+)?de\s+la|cerca\s+del?|junto\s+al?)\s+(?:(?:the|la|el|le|les|los|las)\s+|l['’])?$/iu;
const LINK_FR_ES = new Set(['de', 'du', 'del', 'des', 'la', 'el']);

// Words that start with a capital but are not names: weekdays and months
// (dates have their own kind), number words at a sentence start, "I".
// Function words are here because they are capitalised at a sentence start
// and would otherwise be read as the first word of a name ("The water point").
const FUNCTION_WORDS = ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'our', 'their', 'his', 'her',
  'its', 'my', 'we', 'he', 'she', 'they', 'it', 'there', 'in', 'at', 'on', 'to', 'from', 'near', 'by',
  'and', 'but', 'about', 'le', 'la', 'les', "l'", 'au', 'aux', 'du', 'des', 'nous', 'il', 'elle', 'ils',
  'elles', 'el', 'los', 'las', 'al', 'del', 'en', 'nosotros', 'ella', 'ellos'];
const NOT_NAMES = new Set(['i', ...FUNCTION_WORDS, ...Object.values(MONTHS).flat(), ...Object.values(DAY_WORDS).flat(),
  ...Object.values(NUMBER_WORDS).flat()]);

const isCapitalised = (s) => /^\p{Lu}/u.test(s);
// An acronym (UNHCR, WASH, IDP) is an organisation or a sector, not a place.
const isAcronym = (s) => s.length > 1 && s === s.toUpperCase() && /\p{Lu}/u.test(s);

// The start of a sentence: the text start, or a sentence mark (and perhaps an
// opening quote or bracket) followed by space.
const atSentenceStart = (text, tok) => /(?:^|[.!?…:;]\s+|\n\s*)["'“‘(«]?$/u.test(text.slice(0, tok.start));

function placeSpans(text, tokens, v) {
  const out = [];
  const qualifierRight = (i) => {
    // "de transit", "d'eau", "de la santé" after a place word.
    const a = tokens[i + 1];
    if (!a || !adjacent(text, tokens[i], a)) return 0;
    if (/^d['’]/u.test(a.folded) && PLACE_QUALIFIERS_FR_ES.has(a.folded.slice(2))) return 1;
    if (!LINK_FR_ES.has(a.folded)) return 0;
    const b = tokens[i + 2];
    if (b && adjacent(text, a, b) && PLACE_QUALIFIERS_FR_ES.has(b.folded)) return 2;
    return 0;
  };
  const nameRight = (i) => {
    // "de Kurmadi", "del Norte", or a name straight after: "camp Kalma", "Site B".
    const a = tokens[i + 1];
    if (!a || !adjacent(text, tokens[i], a)) return 0;
    if (isCapitalised(a.text) && !NOT_NAMES.has(a.folded) && !isAcronym(a.text)) return 1;
    if (/^d['’]\p{Lu}/u.test(a.text)) return 1;
    const b = tokens[i + 2];
    if (LINK_FR_ES.has(a.folded) && b && adjacent(text, a, b) && isCapitalised(b.text) && !NOT_NAMES.has(b.folded)) return 2;
    return 0;
  };

  tokens.forEach((tok, i) => {
    if (!v.places.has(tok.folded)) return;
    let s = i;
    let e = i;
    // Left: qualifiers and names, "Kurmadi transit point".
    while (s > 0 && adjacent(text, tokens[s - 1], tokens[s])) {
      const p = tokens[s - 1];
      if (PLACE_QUALIFIERS_EN.has(p.folded) || (isCapitalised(p.text) && !NOT_NAMES.has(p.folded) && !isAcronym(p.text))) s -= 1;
      else break;
    }
    // Right: "de transit", then "de Kurmadi" or a name, repeatedly.
    for (;;) {
      const q = qualifierRight(e);
      if (q) { e += q; continue; }
      const n = nameRight(e);
      if (n) { e += n; continue; }
      break;
    }
    if (NEEDS_QUALIFIER.has(tok.folded) && s === i && e === i) return;
    out.push({ start: tokens[s].start, end: tokens[e].end, kind: 'place' });
  });

  // "the water point near the river" is one location, not two.
  const merged = [];
  for (const sp of out.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && sp.start <= last.end) { last.end = Math.max(last.end, sp.end); continue; }
    if (last && PLACE_RELATION.test(text.slice(last.end, sp.start))) { last.end = sp.end; continue; }
    merged.push({ ...sp });
  }
  return merged;
}

// Capitalised runs in the middle of a sentence: "Kurmadi", "Umm Sirreiba",
// "Omar Nour". A run at a sentence start counts only if it is two words or
// more, because every sentence starts with a capital.
function nameSpans(text, tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!isCapitalised(tok.text) || NOT_NAMES.has(tok.folded) || isAcronym(tok.text) || /^\p{N}/u.test(tok.text)) { i += 1; continue; }
    let j = i;
    while (tokens[j + 1] && adjacent(text, tokens[j], tokens[j + 1]) && isCapitalised(tokens[j + 1].text)
      && !NOT_NAMES.has(tokens[j + 1].folded)) j += 1;
    if (!atSentenceStart(text, tok) || j > i) out.push({ start: tok.start, end: tokens[j].end, kind: 'name' });
    i = j + 1;
  }
  return out;
}

// A place phrase beats a bare name inside it ("Kurmadi" in "Kurmadi transit
// point"); both beat a plain number.
const PRIORITY = { date: 3, time: 3, age: 3, place: 2, name: 1.5, number: 1 };

// Keep the strongest span wherever two overlap: a date, time or age beats a
// plain number inside it, and a longer span beats a shorter one of the same
// strength.
function resolve(spans) {
  const sorted = [...spans].sort((a, b) =>
    (PRIORITY[b.kind] - PRIORITY[a.kind]) || ((b.end - b.start) - (a.end - a.start)) || (a.start - b.start));
  const kept = [];
  for (const s of sorted) {
    if (kept.some((k) => s.start < k.end && k.start < s.end)) continue;
    kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * Every number, date, time and age in `text`.
 * @param {string} text
 * @param {{ langs?: string[], lang?: string }} [opts] the languages the note
 *   may be in (capture language plus lingua franca). Narrows the spelled-number,
 *   month and day vocabulary to those of en/fr/es in the set. `lang` is a
 *   one-language shorthand. Without either, all three are used.
 * @returns {{ start: number, end: number, kind: 'number'|'date'|'time'|'age', text: string }[]}
 */
export function detectFacts(text, opts = {}) {
  if (!text) return [];
  const v = vocabulary(normaliseLangs(opts));
  const tokens = tokenize(text);

  const dates = regexSpans(text, NUMERIC_DATE_RE, 'date');
  const clocks = regexSpans(text, CLOCK_RE, 'time');
  const fixed = resolve([...dates, ...clocks]);
  const free = (s) => !fixed.some((f) => s.start < f.end && f.start < s.end);

  const digits = joinDigitScales(text, digitSpans(text).filter(free), tokens);
  const spelled = spelledSpans(text, tokens, v).filter(free);
  const numbers = [...digits, ...spelled];
  const grown = numbers.map((s) => growNumber(text, s));
  const words = wordDateSpans(text, tokens, numbers, v);

  const places = [...placeSpans(text, tokens, v), ...nameSpans(text, tokens)];

  return resolve([...fixed, ...grown, ...words, ...places])
    .filter((s) => s.end > s.start)
    .map((s) => ({ ...s, text: text.slice(s.start, s.end) }));
}

/**
 * Turn the recognizer's per-word confidences into ranges of `text` to flag.
 *
 * Words are matched in order, each searched for only a short way past the
 * previous match, so one word the recognizer and the text disagree about
 * cannot drag every later word out of place. A word that cannot be found is
 * skipped rather than guessed at.
 *
 * @param {string} text
 * @param {{ word: string, confidence: number }[]} [words]
 * @param {number} [threshold=0.6] flag words with confidence below this
 * @returns {{ start: number, end: number, confidence: number }[]}
 */
export function lowConfidenceRanges(text, words, threshold = 0.6) {
  if (!text || !Array.isArray(words)) return [];
  const hay = fold(text);
  const out = [];
  let cursor = 0;
  for (const w of words) {
    const word = typeof w?.word === 'string' ? w.word.trim() : '';
    if (!word) continue;
    const needle = fold(word);
    const at = hay.indexOf(needle, cursor);
    // Only accept a match within reach of where we are. 80 characters is a
    // couple of short sentences; past that, this word is probably not in the
    // text at all.
    if (at === -1 || at - cursor > 80) continue;
    cursor = at + needle.length;
    const c = Number(w.confidence);
    if (Number.isFinite(c) && c < threshold) out.push({ start: at, end: at + needle.length, confidence: c });
  }
  return out;
}

// Words, runs of spaces and single punctuation marks, with offsets.
function pieces(text) {
  const out = [];
  const re = /\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
  let m;
  while ((m = re.exec(text))) out.push({ t: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/**
 * Carry ranges across an edit from `before` to `after`.
 *
 * The two texts are aligned piece by piece (longest common subsequence), so
 * several separate edits each reset only what they changed. A range survives
 * if every piece it covers is still there, unchanged and still side by side;
 * it moves with the text around it. Anything the edit touched is dropped,
 * because what is there now is the caseworker's own text. Typing right against
 * a range ("1500" becoming "150000") changes its piece, so that counts.
 *
 * Re-flagging only what changed matters as much as flagging at all: resetting
 * every check on any edit teaches people to tap through.
 */
export function carryRanges(ranges, before, after) {
  if (before === after || !ranges.length) return ranges;
  const a = pieces(before);
  const b = pieces(after);
  const n = a.length;
  const m = b.length;
  // LCS table, filled from the end. Notes are a few hundred pieces at most.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i].t === b[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const match = new Int32Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].t === b[j].t) { match[i] = j; i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1; else j += 1;
  }

  const out = [];
  for (const r of ranges) {
    const idx = [];
    for (let i = 0; i < n; i += 1) if (a[i].start < r.end && r.start < a[i].end) idx.push(i);
    if (!idx.length) continue;
    const js = idx.map((i) => match[i]);
    if (js.some((j) => j === -1) || js.some((j, k) => k > 0 && j !== js[k - 1] + 1)) continue;
    const first = b[js[0]];
    const last = b[js[js.length - 1]];
    const start = first.start + (r.start - a[idx[0]].start);
    const end = last.end - (a[idx[idx.length - 1]].end - r.end);
    if (after.slice(start, end) !== before.slice(r.start, r.end)) continue;
    out.push({ ...r, start, end });
  }
  return out;
}

/**
 * The list the caseworker works through: every fact, plus every low-confidence
 * word that is not already inside a fact. A fact that contains a
 * low-confidence word carries `lowConfidence: true` and is still one item, so
 * nobody is asked to confirm the same words twice.
 */
export function reviewItems(text, { langs, lang, unsure = [], confirmed = [] } = {}) {
  const facts = detectFacts(text, { langs, lang });
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  const isConfirmed = (s) => confirmed.some((c) => c.start === s.start && c.end === s.end && c.text === s.text);

  const items = facts.map((f) => ({
    ...f,
    lowConfidence: unsure.some((u) => overlaps(u, f)),
    confirmed: isConfirmed(f)
  }));
  for (const u of unsure) {
    if (facts.some((f) => overlaps(u, f))) continue;
    const s = { start: u.start, end: u.end, kind: 'unsure', text: text.slice(u.start, u.end) };
    items.push({ ...s, lowConfidence: true, confirmed: isConfirmed(s) });
  }
  return items
    .sort((a, b) => a.start - b.start)
    .map((it) => ({ ...it, id: `${it.start}-${it.end}` }));
}
