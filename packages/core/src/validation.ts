export interface Problem {
  code: string;
  path: string;
  message: string;
  hint: string;
  recovery: 'fix-input' | 'fix-environment' | 'report';
  details?: Record<string, unknown>;
}
export type Validation<T> = { ok: true; value: T; errors: [] } | { ok: false; errors: Problem[] };
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInteger = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
export const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const isRelativePath = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && !/[\\\u0000:]/.test(value) && !value.startsWith('/') &&
  value.split('/').every(segment => segment !== '..' && segment !== '.' && segment.length > 0);

export function problem(path: string, message: string, code = 'INVALID_INPUT', hint = 'Correct the named field or type before retrying.'): Problem {
  return { code, path, message, hint, recovery: 'fix-input' };
}

export function unknownFields(object: Record<string, unknown>, allowed: string[], path: string, errors: Problem[]): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) errors.push(problem(path === '$' ? key : `${path}.${key}`, `Unknown field: ${key}.`));
  }
}
