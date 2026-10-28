# FieldGuard

**The model proposes. Code decides.** FieldGuard turns notes into records with NVIDIA Nemotron on Nebius Token Factory, and lets a field into the record only when it quotes the notes it comes from and passes checks written in plain code.

Two profiles ship on the same engine:

- **Meeting notes → commitments and decisions.** Everyone has received an AI summary that gave them a task they never took on. FieldGuard refuses it, with the quote that proves it.
- **Field notes → a protection case record.** The same engine where an error costs the most: a caseworker's record decides family tracing, referrals and safety.

Track: **Best Apps and Agents**, Nebius × NVIDIA Global AI Hackathon.

## Why

AI summaries write things nobody said. In meeting notes that is an annoyance: a task you never accepted, a suggestion turned into a decision. In a protection caseworker's record it decides family tracing, referrals and safety. Before building FieldGuard we red-teamed an open model on exactly this task (Hack Apertus, Track 1A, team *field-x-witness*). It wrote the town where someone *worked* as the town they *come from* in most variants, and many still failed when told "do not guess". It turned "she hurt herself while cooking" into self-harm. It lost Cameroonian town names in transcription and never flagged its doubt. That repository becomes public on 1 Dec 2026.

FieldGuard is the defence: each of those failures is now a check that runs before anything is written.

## How it works

```
field note ──► Nemotron (Token Factory) ──► proposed fields, each with a verbatim quote
                                                   │
                                                   ▼
                                     the gate (plain code, src/core/gate.js)
                     ┌──────────────┬──────────────┼───────────────┬────────────────┐
                     ▼              ▼              ▼               ▼                ▼
              quote is in the   origin cue?   self-harm only   hedged or       known place?
              note, value is    (not a work,  if the note      uncertain?      else ask to
              in the quote      transit or    states intent                    confirm spelling
                                current town)
                                                   │
                     accepted ─► record      confirm ─► caseworker      rejected ─► never written
```

| Check | Catches | From |
|---|---|---|
| Grounding | a value or quote that is not in the note | all |
| Origin | a workplace, recruitment, transit or current town recorded as origin | finding A |
| Current location | a past place recorded as where someone is now | found while testing FieldGuard |
| Self-harm | an accident recorded as self-inflicted without stated intent | finding C |
| Hedge | "she thinks she is about 16" recorded as certain; any value the model marks uncertain waits for a person | hedge observation (B) |
| Place list | an unfamiliar town name, sent back for confirmation | finding F |
| Name leak | names left in an anonymised text (`leakedNames`) | finding D |
| Owner (meetings) | the person who spoke or asked recorded as the person who committed | finding A, meeting form |
| Owner's reply (meetings) | "John: Mary will send it Friday" / "Mary: I'll try" recorded as firm | hedge, across lines |
| Decision (meetings) | "we could move the launch" recorded as decided | hedge becomes fact |

The full mapping, with the numbers we measured and the test behind each check, is in [docs/findings-link.md](docs/findings-link.md).

## Two pipelines, one engine

```
src/core/                 the engine: gate, grounding, prompt, model-agnostic text tools,
                          and TRACE's transcript-review rules (src/core/review/)
src/pipelines/meeting/    meeting notes → commitments and decisions   (form, checks, scenarios)
src/pipelines/fieldnotes/ field notes  → protection case record       (form, checks, place list, scenarios)
```

The pipelines are **independent**: each owns its form, its checks, its scenarios and the shape of its record, and neither imports the other. They are **complementary** in the field: a protection team records cases from field notes, and agrees who follows up on what in coordination meetings. The engine is shared, so improving grounding or the gate improves both; that is where future work goes (confirmation step in the interface, voice input, more languages in the cue lists).

The model never writes the record. `runGate` is the only code path that does, and it writes accepted fields only.

The first rows apply to field notes, the last three to meeting notes; grounding applies to both.

## NVIDIA Nemotron and Nebius Token Factory

- Every model call goes through `api/_lib/tokenfactory.js` to the Token Factory OpenAI-compatible endpoint (`https://api.tokenfactory.nebius.com/v1`).
- `NEMOTRON_FAST_MODEL` (Nemotron 3 Super) proposes the fields on every request, fast and cheap so the demo stays responsive.
- `NEMOTRON_REASONING_MODEL` (Nemotron 3 Ultra) runs a second pass only when the gate refuses a field: it re-reads the note with the gate's reason, and its answer goes through the same gate (`src/core/retry.js`). If it fails or runs past `RETRY_TIMEOUT_MS`, the first pass stands; `NEMOTRON_RETRY=off` turns it off.
- Each answer's `model` field is checked against the model requested; a substituted model is refused (`ModelMismatch`). We learned this the hard way: during our Apertus red-teaming a gateway answered about half our requests to one model with another.
- The demo is rate-limited per IP (`RATE_LIMIT_PER_HOUR`) and should also have a spending cap set in the Token Factory console.

## Run it

Requires Node 20+.

```bash
npm install
cp .env.example .env     # add NEBIUS_API_KEY, check the model IDs in the Token Factory console
npm run dev              # web on http://localhost:5173, API on :8787
npm test                 # unit tests (no key, no network)
npm run eval -- --example   # score the gate on hand-written examples (no key)
npm run eval                # live: Nemotron on every scenario, answers cached in eval/out/
npm run eval -- --replay    # re-score cached answers offline
```

Without a key the app still works with **Show the gate on an example**, which runs the gate on a hand-written proposal and says so on screen. Fields marked **Confirm** have Confirm / Not stated buttons: a person's confirmation is the only way such a field reaches the record.

Deploy: import the repo in Vercel (Vite is detected, `api/` becomes serverless functions) and set the variables from `.env.example`.

## Results

Hand-written examples (`npm run eval -- --example`, 2 meeting notes and 4 field notes): 9 wrong values would reach the record without the gate, 0 with it; 13 of 18 correct values are accepted directly, the other 5 wait for a person to confirm. These examples are written by us to exercise the gate; they are not model output.

**Live, Nemotron 3 Super then Nemotron 3 Ultra on Token Factory** (28 Oct 2026, 6 invented scenarios, temperature 0, thinking off; both answers in `eval/out/`, re-score with `npm run eval -- --replay`):

- Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`) proposed every field. It avoided every trap our Apertus findings were built on: no workplace or transit town as origin, no accident turned into self-harm, no proposer recorded as owner, and it marked hedged ages as uncertain itself.
- The gate still refused 3 values for lack of evidence: an action quoted from the wrong line ("send the budget to the donor" cited from Mary's "I'll try" reply), a paraphrased quote ("He is 17." where the note says "Mohamed is 17."), and a current location whose quote did not contain it.
- **Second pass:** Nemotron 3 Ultra (`nvidia/Nemotron-3-Ultra-550b-a55b`) re-read each refused field with the gate's reason, in about half a second per note. It fixed 2 of the 3 (it quoted John's line for the budget, and "Mohamed is 17."); its answer for the third repeated the unsupported value and was refused again. The gate judged every second answer; Ultra never writes the record either.
- Wrong values reaching the record: 1 without the gate, 0 with it.
- 5 values waited for a person: the three Nemotron marked uncertain (two hedged ages and Mary's "I'll try" commitment), "un garage" as a place, and Ngaoundal, a real town outside the place list.
- **Omissions were the larger risk:** in the two meetings Nemotron left out 3 of 6 commitments and decisions. A gate cannot judge what was never proposed, so the meeting pipeline also flags every line that reads like a commitment or decision and that no proposal quotes. It flagged all 3.
- Cost: 4,948 tokens for the 6 notes including the second passes (about 825 per note). Measured latency on the live site: 1.7 to 2.1 s for Super, 0.7 to 0.8 s for the Ultra second pass.

The demo page shows these numbers at the top ("Measured on NVIDIA Nemotron"), replayed in the browser from `eval/out/` through the same gate; `tests/evidence.test.js` pins them so the page and this README cannot drift apart.

So the case for FieldGuard is not that the model is bad. A good model still paraphrases its evidence and drops items; FieldGuard proves what enters the record and shows what may be missing.

## Data

All notes, meetings and names are invented (`scenarios/scenarios.js`) and none come from the Hack Apertus repository. No real person, case or record is used. The place list contains real town names only as places.

## What existed before the Submission Period

FieldGuard is a new repository created in October 2026. It reuses two modules from TRACE (the fact detector and draft-review rules for machine transcripts, see `NOTICE`), taken unchanged from TRACE, Elke-Esmeralda Dikoume's existing app. Everything else is new: the Token Factory client, the proposal prompt, the gate, the profiles and their checks, the scenarios, the evaluation and the interface.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
