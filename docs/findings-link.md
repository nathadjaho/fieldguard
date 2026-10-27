# From red-teaming to guard: field-x-witness → FieldGuard

Before FieldGuard we red-teamed Apertus 1.5 (8B and 70B) on turning invented caseworker notes from Cameroon into case records (Hack Apertus, Track 1A, team *field-x-witness*, submitted 16 Oct 2026). That repository is private under the event's rules and becomes public on 1 Dec 2026. Only aggregate results are quoted here; no note, prompt or answer from it is reused. FieldGuard's scenarios are new.

Each row: what we measured, the check that now blocks it, and the test that proves the check.

| Finding | Measured on Apertus (failed / variants) | FieldGuard check | Test |
|---|---|---|---|
| **A** Workplace, recruiter or transit town recorded as origin | 57/80 (8B), 69/80 (70B); with an explicit "do not guess" line still 15/40 and 23/40 | `originGuard`: an origin needs an origin cue in its own quote; a quote tied to work, recruitment, transit or a current stay is rejected | `en01`, `fr02` |
| **A, meeting form** The person who spoke or asked recorded as the person who committed | new in FieldGuard (same failure, other domain) | `ownerGuard` | `m-en01`, `m-fr01` |
| **A, second form** A past place recorded as where the person is now | found while testing FieldGuard itself | `currentGuard` (asks, does not reject) | `fr01`, `fr02` |
| **B** French hedge "Il me semble" recorded as certain | 3 of 3 French cases on each model (reported in the text, not submitted) | `hedgeGuard`, `meetingHedgeGuard`, `ownerReplyGuard`, `decisionGuard`: a hedged value or a suggestion goes to confirmation or is refused as a decision | `en01`, `fr01`, `m-en01`, `m-fr01` |
| **C** An accident the person described rewritten as self-harm | 11/32 on both models; 0/32 when only the verb was made passive | `selfHarmGuard`: self-inflicted is recorded only when the quote states intent | `en01`, `fr01`, single-field test |
| **D** Names left in an "anonymised" referral | 1/20 (8B), 3/20 (70B) | `leakedNames` (function and test; not yet in the interface) | anonymisation test |
| **E** Voices invented for audio with no speech | 3/24 (8B), 4/24 (70B) | **Not covered.** FieldGuard takes text only in this version | — |
| **F** Cameroonian town names lost in transcription | 4/20 right, against 15/20 for French and Swiss towns (p = 0.0006) | `placeGuard`: a place outside the list is sent back to confirm its spelling; the model is never trusted to flag its own doubt | `en02` |
| Gateway served another model | 61 of 126 requests for the 70B model answered by a different model | `ModelMismatch` in the Token Factory client | `tokenfactory.test.js` |

Grounding (`judgeField` in `src/core/gate.js`) sits under all of them: a value whose quote is not in the note, or that is not in its own quote, never reaches the record.

## What this does not show

- The Apertus numbers are about Apertus. Nemotron's own failure rates on FieldGuard's scenarios come from `npm run eval` and are reported in the README.
- The checks are rules with word lists in English and French. They will miss phrasings not on the lists; the scenarios and tests are where new phrasings get added.
