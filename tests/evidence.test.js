import { describe, it, expect } from 'vitest';
import { evidence } from '../src/evidence.js';

// Pins the on-page numbers to the recorded Nemotron answers in eval/out/, so
// the page, the README and `npm run eval -- --replay` cannot drift apart.
describe('evidence shown on the page', () => {
  it('replays the six recorded Nemotron answers', () => {
    const { rows, totals } = evidence();
    expect(rows).toHaveLength(6);
    expect(totals).toMatchObject({ wrongBefore: 1, wrongAfter: 0, firstRefused: 3, refused: 1, fixed: 2, omitted: 3, flagged: 3, tokens: 4948 });
  });
});
