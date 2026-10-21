import { expect, it } from 'vitest';
import { validateInput, type InputStep } from '../src/input';
import { LIMITS } from '../src/limits';

const step = (): InputStep => ({ title: 'Step', explanation: 'Explanation', location: { path: 'src/a.ts', startLine: 1, endLine: 2 } });
const input = (steps: InputStep[] = [step()]) => ({ version: 1, title: 'Title', summary: 'Summary', steps });
it('accepts narrative steps and grouping parents with code leaves', () => {
  expect(validateInput(input([{ title: 'Narrative', explanation: 'Context' }, { title: 'Group', explanation: 'Group', children: [step()] }])).ok).toBe(true);
});
it('collects unknown fields, types, evidence and location errors with actionable field paths', () => {
  const result = validateInput({ ...input(), id: 'forbidden', steps: [{ title: 3, explanation: '', evidence: 'fact', location: 'invalid', startColumn: 2 }, { ...step(), location: { path: '../escape', startLine: 0, endLine: 'x' } }] });
  expect(result.ok).toBe(false);
  for (const path of ['id', 'steps[0].title', 'steps[0].explanation', 'steps[0].evidence', 'steps[0].location', 'steps[0].startColumn', 'steps[1].location.path', 'steps[1].location.startLine']) {
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_INPUT', path, hint: expect.any(String), recovery: 'fix-input' }));
  }
  expect(result.errors.some(e => e.path === 'steps[0].location.path')).toBe(false);
});
it('accepts four levels, rejects fifth levels and nested leaves without a location', () => {
  let nested = step();
  for (let i = 0; i < 3; i++) nested = { title: 'Group', explanation: 'Group', children: [nested] };
  expect(validateInput(input([nested])).ok).toBe(true);
  expect(validateInput(input([{ title: 'Fifth', explanation: 'Group', children: [nested] }])).ok).toBe(false);
  expect(validateInput(input([{ title: 'Parent', explanation: 'Group', children: [{ title: 'Leaf', explanation: 'No location' }] }])).errors).toContainEqual(expect.objectContaining({ path: 'steps[0].children[0].location' }));
});
it('enforces counts, string lengths, line spans and location structure', () => {
  expect(validateInput(input(Array.from({ length: LIMITS.steps + 1 }, step))).ok).toBe(false);
  expect(validateInput({ ...input(), title: 'x'.repeat(LIMITS.title + 1), summary: 'x'.repeat(LIMITS.summary + 1) }).errors).toHaveLength(2);
  const s = step(); s.explanation = 'x'.repeat(LIMITS.explanation + 1); s.location!.endLine = LIMITS.locationLines + 1; s.location!.match = 'x'.repeat(LIMITS.match + 1);
  expect(validateInput(input([s])).errors).toHaveLength(3);
  for (const value of [null, {}, { ...input(), steps: [] }]) expect(validateInput(value).ok).toBe(false);
});
