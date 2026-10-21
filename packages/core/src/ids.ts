import { randomBytes } from 'node:crypto';

const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

export function walkthroughId(clock: () => Date = () => new Date(), random: (size: number) => Uint8Array = randomBytes): string {
  const timestamp = clock().toISOString().replace(/[-:.]/g, '');
  const suffix = Array.from(random(6), byte => alphabet[byte & 31]).join('');
  return `${timestamp}-${suffix}`;
}

export function stepId(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Step index must be a nonnegative integer.');
  return `s${index + 1}`;
}
