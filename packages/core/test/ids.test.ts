import { expect, it } from 'vitest';
import { stepId, walkthroughId } from '../src/ids';

it('generates filename/URL-safe IDs ordered by injected creation time', () => {
  const dates = ['2026-10-21T14:30:05.123Z', '2026-10-21T14:30:05.124Z', '2026-10-22T00:00:00.000Z'];
  const ids = dates.map(date => walkthroughId(() => new Date(date)));
  for (const id of ids) {
    expect(id).toMatch(/^\d{8}T\d{9}Z-[a-z2-7]{6}$/);
    expect(encodeURIComponent(id)).toBe(id);
  }
  expect([...ids].sort()).toEqual(ids);
  expect(walkthroughId(() => new Date(dates[0]), () => new Uint8Array([0, 1, 2, 29, 30, 31]))).toBe('20261021T143005123Z-abc567');
});

it('numbers steps in the caller’s depth-first order', () => {
  expect([0, 1, 199].map(stepId)).toEqual(['s1', 's2', 's200']);
  expect(() => stepId(-1)).toThrow(RangeError);
});
