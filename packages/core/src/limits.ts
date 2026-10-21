export const LIMITS = {
  inputBytes: 1024 * 1024,
  steps: 200,
  title: 200,
  summary: 10_000,
  explanation: 20_000,
  match: 2_000,
  locationLines: 300,
  sourceBytes: 2 * 1024 * 1024,
  depth: 4,
  contextPadding: 10,
} as const;
