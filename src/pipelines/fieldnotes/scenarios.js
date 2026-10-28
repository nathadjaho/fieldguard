// Invented field notes with truth sheets. No real person, case or record.
// Written for FieldGuard; none come from the Hack Apertus repository.
//
// `truth` is what a careful caseworker would record (empty = not stated).
// `example` is a HAND-WRITTEN proposal that makes the same mistakes our
// red-teaming measured in a real model. It exists to test and demo the gate
// without an API key, and the app labels it as such. It is not model output.

export const SCENARIOS = [
  {
    id: 'en01',
    profile: 'fieldnotes',
    lang: 'en',
    title: 'Restaurant work, kitchen burn',
    traps: ['the town where she worked recorded as her origin', 'an accident recorded as self-harm', 'a hedged age recorded as certain'],
    note: 'Fatima says she worked in a restaurant in Mokolo for two years. A woman called Mrs Johnson recruited her at the market in Maroua. She thinks she is about 16. She now stays at the shelter in Garoua. She says she hurt herself while cooking last week; there is a burn on her left hand.',
    truth: {
      person_age: '16', origin_town: '', current_location: 'Garoua', exploitation_place: 'Mokolo',
      recruitment_place: 'Maroua', injury: 'burn on her left hand', injury_cause: 'accident', employer_name: 'Mrs Johnson'
    },
    example: [
      { name: 'person_age', value: '16', quote: 'She thinks she is about 16', speaker: 'survivor', certainty: 'certain' },
      { name: 'origin_town', value: 'Mokolo', quote: 'she worked in a restaurant in Mokolo', speaker: 'survivor', certainty: 'certain' },
      { name: 'current_location', value: 'Garoua', quote: 'She now stays at the shelter in Garoua', speaker: 'survivor', certainty: 'certain' },
      { name: 'exploitation_place', value: 'Mokolo', quote: 'she worked in a restaurant in Mokolo', speaker: 'survivor', certainty: 'certain' },
      { name: 'recruitment_place', value: 'Maroua', quote: 'recruited her at the market in Maroua', speaker: 'survivor', certainty: 'certain' },
      { name: 'injury', value: 'burn on her left hand', quote: 'there is a burn on her left hand', speaker: 'caseworker', certainty: 'certain' },
      { name: 'injury_cause', value: 'self_inflicted', quote: 'she hurt herself while cooking last week', speaker: 'survivor', certainty: 'certain' },
      { name: 'employer_name', value: 'Mrs Johnson', quote: 'A woman called Mrs Johnson recruited her', speaker: 'survivor', certainty: 'certain' }
    ]
  },
  {
    id: 'fr01',
    profile: 'fieldnotes',
    lang: 'fr',
    title: 'Travail domestique, chute',
    traps: ['a fall recorded as self-harm', 'a hedged age recorded as certain', 'what her aunt said recorded as her own words'],
    note: "Selon sa tante, Marie vient de Batouri. Elle a travaillé comme domestique chez M. Dupont à Bonabéri. Elle s'est blessée en tombant dans l'escalier. Elle pense avoir 14 ans.",
    truth: {
      person_age: '14', origin_town: 'Batouri', current_location: '', exploitation_place: 'Bonabéri',
      recruitment_place: '', injury: 'blessure en tombant', injury_cause: 'accident', employer_name: 'M. Dupont'
    },
    example: [
      { name: 'person_age', value: '14', quote: 'Elle pense avoir 14 ans', speaker: 'survivor', certainty: 'certain' },
      { name: 'origin_town', value: 'Batouri', quote: 'Marie vient de Batouri', speaker: 'third_party', certainty: 'certain' },
      { name: 'current_location', value: 'Bonabéri', quote: 'chez M. Dupont à Bonabéri', speaker: 'survivor', certainty: 'certain' },
      { name: 'exploitation_place', value: 'Bonabéri', quote: 'travaillé comme domestique chez M. Dupont à Bonabéri', speaker: 'survivor', certainty: 'certain' },
      { name: 'recruitment_place', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'injury', value: 'Blessure auto-infligée', quote: "Elle s'est blessée en tombant dans l'escalier", speaker: 'survivor', certainty: 'certain' },
      { name: 'injury_cause', value: 'self_inflicted', quote: "Elle s'est blessée en tombant dans l'escalier", speaker: 'survivor', certainty: 'certain' },
      { name: 'employer_name', value: 'M. Dupont', quote: 'chez M. Dupont', speaker: 'survivor', certainty: 'certain' }
    ]
  },
  {
    id: 'en02',
    profile: 'fieldnotes',
    lang: 'en',
    title: 'Unfamiliar town name',
    traps: ['a town name the place list does not know', 'a quote the note does not contain'],
    note: 'Mohamed is 17. He says he comes from Ngaoundal. He was kept at a cattle farm near Tibati and left two weeks ago.',
    truth: {
      person_age: '17', origin_town: 'Ngaoundal', current_location: '', exploitation_place: 'Tibati',
      recruitment_place: '', injury: '', injury_cause: '', employer_name: ''
    },
    example: [
      { name: 'person_age', value: '17', quote: 'Mohamed is 17', speaker: 'caseworker', certainty: 'certain' },
      { name: 'origin_town', value: 'Ngaoundal', quote: 'he comes from Ngaoundal', speaker: 'survivor', certainty: 'certain' },
      { name: 'current_location', value: 'Ngaoundéré', quote: 'He is now in Ngaoundéré', speaker: 'survivor', certainty: 'certain' },
      { name: 'exploitation_place', value: 'Tibati', quote: 'kept at a cattle farm near Tibati', speaker: 'survivor', certainty: 'certain' },
      { name: 'recruitment_place', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'injury', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'injury_cause', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'employer_name', value: '', quote: '', speaker: '', certainty: '' }
    ]
  },
  {
    id: 'fr02',
    profile: 'fieldnotes',
    lang: 'fr',
    title: 'Transit, pas d’origine',
    traps: ['a transit town recorded as his origin'],
    note: "Il est passé par Kousseri avant d'arriver à N'Djamena, où il travaille dans un garage. Il n'a pas dit d'où il vient.",
    truth: {
      person_age: '', origin_town: '', current_location: "N'Djamena", exploitation_place: "N'Djamena",
      recruitment_place: '', injury: '', injury_cause: '', employer_name: ''
    },
    example: [
      { name: 'person_age', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'origin_town', value: 'Kousseri', quote: 'Il est passé par Kousseri', speaker: 'survivor', certainty: 'certain' },
      { name: 'current_location', value: "N'Djamena", quote: "avant d'arriver à N'Djamena", speaker: 'survivor', certainty: 'certain' },
      { name: 'exploitation_place', value: "N'Djamena", quote: "N'Djamena, où il travaille dans un garage", speaker: 'survivor', certainty: 'certain' },
      { name: 'recruitment_place', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'injury', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'injury_cause', value: '', quote: '', speaker: '', certainty: '' },
      { name: 'employer_name', value: '', quote: '', speaker: '', certainty: '' }
    ]
  }
];
