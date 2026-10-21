import { expect, it } from 'vitest';
import { LIMITS } from '../src/limits';

it('exports the v1 authoring and anchoring limits', () => {
  expect(LIMITS).toEqual({ inputBytes: 1_048_576, steps: 200, title: 200, summary: 10_000,
    explanation: 20_000, match: 2_000, locationLines: 300, sourceBytes: 2_097_152, depth: 4, contextPadding: 10 });
});
