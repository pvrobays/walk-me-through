import { comparePositions, type Range } from './coords';
import { LIMITS } from './limits';
import { isInteger, isRecord, isRelativePath, isText, problem, type Problem, type Validation } from './validation';

export type Evidence = 'observation' | 'hypothesis' | 'conclusion';
export interface Anchor {
  algorithm: 'sha256-lf-v1';
  selectionText: string;
  context: { startLine: number; lineCount: number; length: number; hash: string; unique: boolean };
  selectionInContext: { start: number; end: number };
}
export interface Location { path: string; range: Range; anchor: Anchor }
export interface Step { id: string; parentId?: string | null; title: string; explanation: string; evidence?: Evidence; location?: Location }
export interface Environment { kind: string; platform: string; unsupportedOverride: boolean }
export interface Artifact {
  schemaVersion: 1;
  generator: { name: 'walk-me-through'; bundleVersion: string };
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  project: { root: string; environment: Environment };
  source: { git: { commit: string; dirty: boolean } | null };
  steps: Step[];
}

export const evidenceValues = ['observation', 'hypothesis', 'conclusion'];
const position = (v: unknown): v is Range['start'] => isRecord(v) && isInteger(v.line) && isInteger(v.character);
const utcTimestamp = (v: unknown): v is string => typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;

function validateLocation(value: unknown, path: string, errors: Problem[]): void {
  const add = (field: string, message: string) => errors.push(problem(`${path}${field}`, message, 'INVALID_ARTIFACT'));
  if (!isRecord(value)) { add('', 'Expected a location object.'); return; }
  if (!isRelativePath(value.path)) add('.path', 'Expected a project-relative forward-slash path without escaping segments.');
  const range = value.range;
  const rangeValid = isRecord(range) && position(range.start) && position(range.end);
  if (!rangeValid) add('.range', 'Expected nonnegative integer line and character positions.');
  else if (comparePositions(range.start as Range['start'], range.end as Range['end']) >= 0) add('.range', 'Range must be nonempty and end after its start.');
  const anchor = value.anchor;
  if (!isRecord(anchor)) { add('.anchor', 'Expected captured anchor metadata.'); return; }
  if (anchor.algorithm !== 'sha256-lf-v1') add('.anchor.algorithm', 'Unsupported anchor algorithm.');
  if (typeof anchor.selectionText !== 'string' || !anchor.selectionText.trim() || /\r|\u0000/.test(anchor.selectionText) || anchor.selectionText.length > LIMITS.sourceBytes) {
    add('.anchor.selectionText', 'Expected nonempty, normalized selection text within the source size limit.');
  }
  const context = anchor.context;
  const contextValid = isRecord(context) && isInteger(context.startLine) && isInteger(context.lineCount, 1) &&
    context.lineCount <= LIMITS.locationLines + 2 * LIMITS.contextPadding && isInteger(context.length, 1) &&
    context.length <= LIMITS.sourceBytes && typeof context.hash === 'string' && /^[a-f0-9]{64}$/.test(context.hash) && typeof context.unique === 'boolean';
  if (!contextValid) add('.anchor.context', 'Expected bounded context line span, UTF-16 length, SHA-256 hash, and unique flag.');
  const selection = anchor.selectionInContext;
  const selectionValid = isRecord(selection) && isInteger(selection.start) && isInteger(selection.end, 1) &&
    selection.end > selection.start && typeof anchor.selectionText === 'string' && selection.end - selection.start === anchor.selectionText.length;
  if (!selectionValid || (contextValid && selectionValid && (selection.end as number) > (context.length as number))) add('.anchor.selectionInContext', 'Selection offsets must fit context and match the selected text length.');
  if (rangeValid && contextValid) {
    const start = range.start as Range['start']; const end = range.end as Range['end'];
    if (end.line - start.line + 1 > LIMITS.locationLines || start.line < (context.startLine as number) || end.line >= (context.startLine as number) + (context.lineCount as number)) add('.range', 'Range must fit captured context and the location span limit.');
    if (typeof anchor.selectionText === 'string') {
      const lines = anchor.selectionText.split('\n');
      const expectedEndCharacter = lines.length === 1 ? start.character + lines[0].length : lines.at(-1)!.length;
      if (end.line !== start.line + lines.length - 1 || end.character !== expectedEndCharacter) add('.range', 'Range dimensions must match selection text.');
    }
  }
}

export function validateArtifact(value: unknown): Validation<Artifact> {
  const errors: Problem[] = [];
  const add = (path: string, message: string) => errors.push(problem(path, message, 'INVALID_ARTIFACT'));
  if (!isRecord(value)) return { ok: false, errors: [problem('$', 'Expected an artifact object.', 'INVALID_ARTIFACT')] };
  if (value.schemaVersion !== 1) add('schemaVersion', 'Unsupported schemaVersion. Update the viewer to read this walkthrough.');
  if (!isRecord(value.generator) || value.generator.name !== 'walk-me-through' || typeof value.generator.bundleVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.generator.bundleVersion)) add('generator', 'Expected generator name and semantic bundle version.');
  if (typeof value.id !== 'string' || !/^\d{8}T\d{9}Z-[a-z2-7]{6}$/.test(value.id)) add('id', 'Expected a timestamp and six lowercase base32 characters.');
  if (!utcTimestamp(value.createdAt)) add('createdAt', 'Expected an ISO-8601 UTC millisecond timestamp.');
  if (!isText(value.title, LIMITS.title)) add('title', `Title must contain 1–${LIMITS.title} characters.`);
  if (!isText(value.summary, LIMITS.summary)) add('summary', `Summary must contain 1–${LIMITS.summary} characters.`);
  const project = value.project;
  if (!isRecord(project) || typeof project.root !== 'string' || !/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(project.root)) add('project.root', 'Expected an absolute project root.');
  if (!isRecord(project) || !isRecord(project.environment) || !isText(project.environment.kind, 100) || !isText(project.environment.platform, 100) || typeof project.environment.unsupportedOverride !== 'boolean') add('project.environment', 'Expected environment kind, platform, and unsupportedOverride.');
  if (!isRecord(value.source) || (value.source.git !== null && (!isRecord(value.source.git) || typeof value.source.git.commit !== 'string' || !/^[a-f0-9]{7,64}$/i.test(value.source.git.commit) || typeof value.source.git.dirty !== 'boolean'))) add('source.git', 'Expected git commit and dirty flag, or null.');
  if (!Array.isArray(value.steps) || value.steps.length === 0 || value.steps.length > LIMITS.steps) {
    add('steps', `Expected 1–${LIMITS.steps} steps.`);
  }
  if (Array.isArray(value.steps)) {
    const steps = value.steps;
    const seen = new Map<string, number>();
    const depths = new Map<string, number>();
    let ancestry: string[] = [];
    const parentIds = new Set(steps.filter(isRecord).map(step => step.parentId).filter(id => typeof id === 'string'));
    steps.forEach((step: unknown, i: number) => {
      const p = `steps[${i}]`;
      if (!isRecord(step)) { add(p, 'Expected a step object.'); return; }
      if (!isText(step.id, 200)) add(`${p}.id`, 'Expected a nonempty step ID.');
      else {
        if (seen.has(step.id)) add(`${p}.id`, 'Duplicate step ID.');
        seen.set(step.id, i);
      }
      const parent = step.parentId;
      let depth = 1;
      if (parent !== null && parent !== undefined) {
        if (typeof parent !== 'string' || !seen.has(parent) || seen.get(parent)! >= i) add(`${p}.parentId`, 'Parent must refer to an earlier step; missing, forward, and cyclic parents are invalid.');
        else {
          depth = (depths.get(parent) ?? 1) + 1;
          if (!ancestry.includes(parent)) add(`${p}.parentId`, 'Steps must be in depth-first pre-order.');
          ancestry = ancestry.slice(0, ancestry.indexOf(parent) + 1);
        }
      } else ancestry = [];
      if (depth > LIMITS.depth) add(p, `Step exceeds maximum depth ${LIMITS.depth}.`);
      if (typeof step.id === 'string') { depths.set(step.id, depth); ancestry.push(step.id); }
      if (!isText(step.title, LIMITS.title)) add(`${p}.title`, `Expected title within ${LIMITS.title} characters.`);
      if (!isText(step.explanation, LIMITS.explanation)) add(`${p}.explanation`, `Expected explanation within ${LIMITS.explanation} characters.`);
      if (step.evidence !== undefined && !evidenceValues.includes(step.evidence as string)) add(`${p}.evidence`, 'Expected observation, hypothesis, or conclusion.');
      if (step.location === undefined) {
        if (parent !== undefined && parent !== null && !parentIds.has(step.id as string)) add(`${p}.location`, 'Nested leaf steps require a source location.');
      } else validateLocation(step.location, `${p}.location`, errors);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: value as unknown as Artifact, errors: [] };
}
