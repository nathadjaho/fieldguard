import { describe, it, expect } from 'vitest';
import { detectFacts, lowConfidenceRanges, carryRanges, reviewItems, spelledNumberCoverage } from '../src/core/review/transcriptFacts.js';

// Shorthand: [kind, text] for every fact found.
const facts = (text, opts) => detectFacts(text, opts).map((f) => [f.kind, f.text]);

describe('detectFacts: the failures the speech research actually saw', () => {
  it('flags a large number so "150000" heard as "1500" cannot be skimmed past', () => {
    expect(facts('About 1500 people arrived.')).toEqual([['number', '1500']]);
    expect(facts('About 150000 people arrived.')).toEqual([['number', '150000']]);
  });

  it('flags a spelled count inside a phrase', () => {
    // The river is a location, which is one of the three critical slots.
    expect(facts('Two shelters flooded near the river.')).toEqual([['number', 'Two'], ['place', 'river']]);
  });
});

describe('detectFacts: numerals', () => {
  it('keeps thousands separators inside one number', () => {
    expect(facts('approximately 2,400 individuals')).toEqual([['number', '2,400']]);
    expect(facts('environ 2 400 personnes')).toEqual([['number', '2 400']]);
    expect(facts('environ 2 400 personnes')).toEqual([['number', '2 400']]);
    expect(facts('unos 2.400 recién llegados')).toEqual([['number', '2.400']]);
  });

  it('does not glue two separate small numbers into one', () => {
    expect(facts('rooms 3 12')).toEqual([['number', '3'], ['number', '12']]);
  });

  it('includes decimals and percentages', () => {
    expect(facts('coverage fell to 37.5% this week')).toEqual([['number', '37.5%']]);
  });

  it('joins a digit to its scale word', () => {
    expect(facts('2 million litres')).toEqual([['number', '2 million']]);
    expect(facts('150 mil personas')).toEqual([['number', '150 mil']]);
  });
});

describe('detectFacts: spelled-out numbers', () => {
  it('English, including "and" inside a number', () => {
    expect(facts('one hundred and fifty families')).toEqual([['number', 'one hundred and fifty']]);
    expect(facts('twenty-one tents')).toEqual([['number', 'twenty-one']]);
  });

  it('does not let "and" join a number to the next word', () => {
    expect(facts('three tents and water')).toEqual([['number', 'three']]);
  });

  it('French, including hyphenated and "et" compounds', () => {
    expect(facts('quatre-vingt-dix familles')).toEqual([['number', 'quatre-vingt-dix']]);
    expect(facts('vingt et un enfants')).toEqual([['number', 'vingt et un']]);
    expect(facts('deux mille quatre cents arrivants')).toEqual([['number', 'deux mille quatre cents']]);
    // The article belongs to the approximate count: "about ten".
    expect(facts('une dizaine de personnes')).toEqual([['number', 'une dizaine']]);
  });

  it('Spanish, including accents and "y" compounds', () => {
    expect(facts('treinta y dos familias')).toEqual([['number', 'treinta y dos']]);
    expect(facts('dieciséis niños')).toEqual([['number', 'dieciséis']]);
    expect(facts('dos mil cuatrocientas personas')).toEqual([['number', 'dos mil cuatrocientas']]);
  });

  it('does not flag a lone French or Spanish article', () => {
    expect(facts('un enfant est arrivé')).toEqual([]);
    expect(facts('una familia llegó')).toEqual([]);
  });

  it('narrows the vocabulary when a language is given', () => {
    // Spanish "once" is eleven; English "once" is not a number.
    expect(facts('We met once.')).toEqual([['number', 'once']]);
    expect(facts('We met once.', { lang: 'en' })).toEqual([]);
    expect(facts('Llegaron once personas.', { lang: 'es' })).toEqual([['number', 'once']]);
  });
});

describe('detectFacts: language sets', () => {
  // Field speech code-switches: Lingala intake carries French numbers, Hausa
  // carries English ones. The caller passes the capture language plus the
  // region's lingua franca.
  it('reads the numbers of the lingua franca inside another language', () => {
    expect(facts('Bato quinze bakomi lobi', { langs: ['ln', 'fr'] })).toEqual([['number', 'quinze']]);
    expect(facts('Mutane fifty sun zo', { langs: ['ha', 'en'] })).toEqual([['number', 'fifty']]);
  });

  it('does not borrow another language\'s words outside the set', () => {
    // "once" is a number only if Spanish is in the set.
    expect(facts('We met once.', { langs: ['en', 'fr'] })).toEqual([]);
  });

  it('with no covered language, finds digits and clock times only', () => {
    expect(facts('Mutane 2,400 sun zo da karfe 14:30, biyu kuma', { langs: ['ha'] }))
      .toEqual([['number', '2,400'], ['time', '14:30']]);
    // Without the set, English/French/Spanish vocabulary would hit "six" here.
    expect(facts('six', { langs: ['ha'] })).toEqual([]);
  });

  it('accepts locale tags as well as bare codes', () => {
    expect(facts('quinze', { langs: ['fr-CD'] })).toEqual([['number', 'quinze']]);
  });

  it('reports which languages spelled numbers are not read in', () => {
    expect(spelledNumberCoverage(['ln', 'fr'])).toEqual({ covered: ['fr'], uncovered: ['ln'] });
    expect(spelledNumberCoverage(['ha'])).toEqual({ covered: [], uncovered: ['ha'] });
    expect(spelledNumberCoverage(undefined).uncovered).toEqual([]);
  });
});

describe('detectFacts: dates', () => {
  it('numeric dates are one date, not three numbers', () => {
    expect(facts('arrived on 12/03/2026 at the site')).toEqual([['date', '12/03/2026'], ['place', 'site']]);
    expect(facts('since 2026-10-05')).toEqual([['date', '2026-10-05']]);
  });

  it('day and month in all three languages', () => {
    expect(facts('on 3 March 2026')).toEqual([['date', '3 March 2026']]);
    expect(facts('on March 3rd, 2026')).toEqual([['date', 'March 3rd, 2026']]);
    expect(facts('le 3 mars')).toEqual([['date', '3 mars']]);
    expect(facts('el 3 de marzo de 2026')).toEqual([['date', '3 de marzo de 2026']]);
    expect(facts('le trois mars')).toEqual([['date', 'trois mars']]);
  });

  it('a full month name alone is still a date', () => {
    expect(facts('since February')).toEqual([['date', 'February']]);
  });

  it('"may" the verb is not a date, "May 4" is', () => {
    expect(facts('They may leave soon.')).toEqual([]);
    expect(facts('They left on May 4.')).toEqual([['date', 'May 4']]);
  });

  it('weekdays and relative days', () => {
    expect(facts('they left yesterday')).toEqual([['date', 'yesterday']]);
    expect(facts('arrivés hier soir')).toEqual([['date', 'hier']]);
    expect(facts("aujourd'hui")).toEqual([['date', "aujourd'hui"]]);
    expect(facts('llegaron el martes')).toEqual([['date', 'martes']]);
    expect(facts('pasado mañana')).toEqual([['date', 'pasado mañana']]);
  });
});

describe('detectFacts: times', () => {
  it('clock times', () => {
    expect(facts('at 14:30 the truck came')).toEqual([['time', '14:30']]);
    expect(facts('à 14h30')).toEqual([['time', '14h30']]);
    expect(facts('around 6 pm')).toEqual([['time', '6 pm']]);
    expect(facts('around 6:15 a.m.')).toEqual([['time', '6:15 a.m.']]);
  });

  it('spoken times', () => {
    expect(facts('at three o’clock')).toEqual([['time', 'three o’clock']]);
    expect(facts('vers 15 heures')).toEqual([['time', '15 heures']]);
    expect(facts('a las tres')).toEqual([['time', 'a las tres']]);
    expect(facts('until midnight')).toEqual([['time', 'midnight']]);
  });
});

describe('detectFacts: ages', () => {
  it('English', () => {
    expect(facts('a girl, 12 years old, alone')).toEqual([['age', '12 years old']]);
    expect(facts('a 12-year-old boy')).toEqual([['age', '12-year-old']]);
    expect(facts('children aged 5')).toEqual([['age', 'aged 5']]);
    expect(facts('a baby six months old')).toEqual([['age', 'six months old']]);
    expect(facts('twelve years old')).toEqual([['age', 'twelve years old']]);
  });

  it('French and Spanish ages, but not durations', () => {
    expect(facts('il a 12 ans')).toEqual([['age', '12 ans']]);
    expect(facts('une fille âgée de quinze ans')).toEqual([['age', 'quinze ans']]);
    expect(facts('una niña de doce años')).toEqual([['age', 'doce años']]);
    expect(facts('tiene 7 años')).toEqual([['age', '7 años']]);
    // Durations are still numbers to confirm, just not labelled as ages.
    expect(facts('pendant 3 ans')).toEqual([['number', '3']]);
    expect(facts('durante dos años')).toEqual([['number', 'dos']]);
  });
});

describe('detectFacts: offsets', () => {
  it('slices back to exactly the original text, accents included', () => {
    const text = 'Llegaron dieciséis personas el 3 de marzo, una niña de doce años.';
    for (const f of detectFacts(text)) expect(text.slice(f.start, f.end)).toBe(f.text);
  });

  it('returns nothing for empty input', () => {
    expect(detectFacts('')).toEqual([]);
    expect(detectFacts(undefined)).toEqual([]);
  });
});

describe('lowConfidenceRanges', () => {
  const text = 'Two sand heart flooded near the river.';
  const words = [
    { word: 'Two', confidence: 0.95 },
    { word: 'sand', confidence: 0.41 },
    { word: 'heart', confidence: 0.38 },
    { word: 'flooded', confidence: 0.9 },
    { word: 'near', confidence: 0.6 },
    { word: 'the', confidence: 0.99 },
    { word: 'river', confidence: 0.59 }
  ];

  it('flags words below the threshold, and not at it', () => {
    const r = lowConfidenceRanges(text, words);
    expect(r.map((x) => text.slice(x.start, x.end))).toEqual(['sand', 'heart', 'river']);
  });

  it('respects a different threshold', () => {
    const r = lowConfidenceRanges(text, words, 0.4);
    expect(r.map((x) => text.slice(x.start, x.end))).toEqual(['heart']);
  });

  it('skips a word that is not in the text without derailing the rest', () => {
    const r = lowConfidenceRanges(text, [{ word: 'shelters', confidence: 0.1 }, ...words]);
    expect(r.map((x) => text.slice(x.start, x.end))).toEqual(['sand', 'heart', 'river']);
  });

  it('matches the second "the" for the second "the"', () => {
    const t = 'the camp and the river';
    const r = lowConfidenceRanges(t, [
      { word: 'the', confidence: 0.9 }, { word: 'camp', confidence: 0.9 },
      { word: 'and', confidence: 0.9 }, { word: 'the', confidence: 0.2 }
    ]);
    expect(r).toEqual([{ start: 13, end: 16, confidence: 0.2 }]);
  });

  it('tolerates missing input', () => {
    expect(lowConfidenceRanges(text, undefined)).toEqual([]);
    expect(lowConfidenceRanges('', words)).toEqual([]);
  });
});

describe('carryRanges', () => {
  it('shifts ranges after an edit and drops the ones the edit touched', () => {
    const before = 'About 1500 people, 2 shelters.';
    const after = 'About 150000 people, 2 shelters.';
    const ranges = [
      { start: 0, end: 5 }, // "About", before the edit
      { start: 6, end: 10 }, // "1500", edited
      { start: 19, end: 20 } // "2", after the edit
    ];
    expect(carryRanges(ranges, before, after)).toEqual([
      { start: 0, end: 5 },
      { start: 21, end: 22 }
    ]);
  });

  it('two separate edits reset only what each one changed', () => {
    const before = 'About 1500 people, 2 shelters, on Monday.';
    const after = 'About 150000 people, 2 shelters, on Tuesday.';
    const ranges = [
      { start: 6, end: 10, text: '1500' },
      { start: 19, end: 20, text: '2' },
      { start: 34, end: 40, text: 'Monday' }
    ];
    expect(carryRanges(ranges, before, after)).toEqual([{ start: 21, end: 22, text: '2' }]);
  });

  it('keeps a multi-piece range that survived intact', () => {
    const before = 'About 2,400 people arrived.';
    const after = 'Roughly 2,400 people arrived.';
    expect(carryRanges([{ start: 6, end: 11 }], before, after)).toEqual([{ start: 8, end: 13 }]);
  });

  it('treats typing right against a range as touching it', () => {
    expect(carryRanges([{ start: 0, end: 4 }], '1500 people', '150000 people')).toEqual([]);
  });

  it('is a no-op when nothing changed', () => {
    const r = [{ start: 1, end: 2 }];
    expect(carryRanges(r, 'abc', 'abc')).toBe(r);
  });
});

describe('reviewItems', () => {
  it('merges a low-confidence word into the fact it sits in', () => {
    const text = 'About 1500 people.';
    const items = reviewItems(text, { unsure: [{ start: 6, end: 10, confidence: 0.3 }] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'number', text: '1500', lowConfidence: true, confirmed: false });
  });

  it('lists a low-confidence word outside any fact as its own item', () => {
    const text = 'Two sand heart flooded.';
    const items = reviewItems(text, { unsure: [{ start: 4, end: 8, confidence: 0.4 }] });
    expect(items.map((i) => [i.kind, i.text])).toEqual([['number', 'Two'], ['unsure', 'sand']]);
  });

  it('counts an item as confirmed only if its exact text and place were confirmed', () => {
    const text = 'About 1500 people.';
    expect(reviewItems(text, { confirmed: [{ start: 6, end: 10, text: '1500' }] })[0].confirmed).toBe(true);
    expect(reviewItems(text, { confirmed: [{ start: 6, end: 10, text: '1600' }] })[0].confirmed).toBe(false);
  });
});
