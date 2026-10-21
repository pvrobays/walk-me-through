export function retryDelay(attempt: number, baseDelay = 100): number {
  return baseDelay * 2 ** attempt;
}
