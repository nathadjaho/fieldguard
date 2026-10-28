// Invented field notes with truth sheets. No real person, case or record.
// Written for FieldGuard; none come from the Hack Apertus repository.
//
// `truth` is what a careful caseworker would record (empty = not stated).
// `example` is a HAND-WRITTEN proposal that makes the same mistakes our
// red-teaming measured in a real model. It exists to test and demo the gate
// without an API key, and the app labels it as such. It is not model output.

export const SCENARIOS = [
  {
    id: 'm-en01',
    profile: 'meeting',
    lang: 'en',
    title: 'Budget and launch',
    traps: ['the speaker recorded as the owner', '"I\'ll try" recorded as firm', 'a suggestion recorded as a decision'],
    note: [
      'John: Mary will send the budget to the donor by Friday.',
      "Mary: I'll try, but I need the figures from David first.",
      'David: I can share the figures tomorrow morning.',
      "John: We could also move the launch to March, let's think about it.",
      'Sarah: Agreed, we keep the training on 12 November.'
    ].join('\n'),
    truth: {
      commitments: [
        { owner: 'Mary', action: 'budget', due: 'Friday', certainty: 'uncertain' },
        { owner: 'David', action: 'figures', due: 'tomorrow morning', certainty: 'certain' }
      ],
      decisions: ['training on 12 November']
    },
    example: [
      { name: 'commitment_owner', value: 'John', quote: 'John: Mary will send the budget to the donor by Friday', speaker: 'John', certainty: 'certain', group: '1' },
      { name: 'commitment_action', value: 'Send the budget to the donor', quote: 'Mary will send the budget to the donor by Friday', speaker: 'John', certainty: 'certain', group: '1' },
      { name: 'commitment_due', value: 'Friday', quote: 'Mary will send the budget to the donor by Friday', speaker: 'John', certainty: 'certain', group: '1' },
      { name: 'commitment_owner', value: 'David', quote: 'I can share the figures tomorrow morning', speaker: 'David', certainty: 'certain', group: '2' },
      { name: 'commitment_action', value: 'Share the figures', quote: 'I can share the figures tomorrow morning', speaker: 'David', certainty: 'certain', group: '2' },
      { name: 'commitment_due', value: 'tomorrow morning', quote: 'I can share the figures tomorrow morning', speaker: 'David', certainty: 'certain', group: '2' },
      { name: 'decision', value: 'Move the launch to March', quote: 'We could also move the launch to March', speaker: 'John', certainty: 'certain', group: '3' },
      { name: 'decision', value: 'Keep the training on 12 November', quote: 'Agreed, we keep the training on 12 November', speaker: 'Sarah', certainty: 'certain', group: '4' }
    ]
  },
  {
    id: 'm-fr01',
    profile: 'meeting',
    lang: 'fr',
    title: 'Rapport et fournisseur',
    traps: ['the person who proposed recorded as the owner', '"peut-être" (maybe) recorded as firm'],
    note: [
      'Sophie : Je propose que Pierre prépare le rapport pour lundi.',
      "Pierre : D'accord, je m'en occupe, lundi c'est bon.",
      'Sophie : On a décidé de garder le budget actuel.',
      'Marc : Je vais peut-être appeler le fournisseur demain.'
    ].join('\n'),
    truth: {
      commitments: [
        { owner: 'Pierre', action: 'rapport', due: 'lundi', certainty: 'certain' },
        { owner: 'Marc', action: 'fournisseur', due: 'demain', certainty: 'uncertain' }
      ],
      decisions: ['garder le budget actuel']
    },
    example: [
      { name: 'commitment_owner', value: 'Sophie', quote: 'Je propose que Pierre prépare le rapport pour lundi', speaker: 'Sophie', certainty: 'certain', group: '1' },
      { name: 'commitment_action', value: 'Préparer le rapport', quote: 'Pierre prépare le rapport pour lundi', speaker: 'Sophie', certainty: 'certain', group: '1' },
      { name: 'commitment_due', value: 'lundi', quote: 'le rapport pour lundi', speaker: 'Sophie', certainty: 'certain', group: '1' },
      { name: 'commitment_owner', value: 'Marc', quote: 'Je vais peut-être appeler le fournisseur demain', speaker: 'Marc', certainty: 'certain', group: '2' },
      { name: 'commitment_action', value: 'Appeler le fournisseur', quote: 'Je vais peut-être appeler le fournisseur demain', speaker: 'Marc', certainty: 'certain', group: '2' },
      { name: 'commitment_due', value: 'demain', quote: 'appeler le fournisseur demain', speaker: 'Marc', certainty: 'certain', group: '2' },
      { name: 'decision', value: 'Garder le budget actuel', quote: 'On a décidé de garder le budget actuel', speaker: 'Sophie', certainty: 'certain', group: '3' }
    ]
  }
];
