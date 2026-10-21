import { evidenceValues, type Evidence } from './artifact';
import { LIMITS } from './limits';
import { isInteger, isRecord, isRelativePath, isText, problem, unknownFields, type Problem, type Validation } from './validation';

export interface InputLocation { path: string; startLine: number; endLine: number; match?: string }
export interface InputStep { title: string; explanation: string; evidence?: Evidence; location?: InputLocation; children?: InputStep[] }
export interface Input { version: 1; title: string; summary: string; steps: InputStep[] }

export function validateInput(value: unknown): Validation<Input> {
  const errors: Problem[] = [];
  if (!isRecord(value)) return { ok: false, errors: [problem('$', 'Expected an input object.')] };
  unknownFields(value, ['version', 'title', 'summary', 'steps'], '$', errors);
  if (value.version !== 1) errors.push(problem('version', 'Expected input version 1.'));
  if (!isText(value.title, LIMITS.title)) errors.push(problem('title', `Expected a nonempty title of at most ${LIMITS.title} characters.`));
  if (!isText(value.summary, LIMITS.summary)) errors.push(problem('summary', `Expected a nonempty summary of at most ${LIMITS.summary} characters.`));
  let count = 0;
  function visit(steps: unknown, path: string, depth: number): void {
    if (!Array.isArray(steps) || !steps.length) { errors.push(problem(path, 'Expected a nonempty steps array.')); return; }
    steps.forEach((step, index) => {
      count++;
      const p = `${path}[${index}]`;
      if (!isRecord(step)) { errors.push(problem(p, 'Expected a step object.')); return; }
      unknownFields(step, ['title', 'explanation', 'evidence', 'location', 'children'], p, errors);
      if (depth > LIMITS.depth) errors.push(problem(p, `Maximum depth is ${LIMITS.depth}.`));
      if (!isText(step.title, LIMITS.title)) errors.push(problem(`${p}.title`, `Expected a nonempty title of at most ${LIMITS.title} characters.`));
      if (!isText(step.explanation, LIMITS.explanation)) errors.push(problem(`${p}.explanation`, `Expected a nonempty explanation of at most ${LIMITS.explanation} characters.`));
      if (step.evidence !== undefined && !evidenceValues.includes(step.evidence as string)) errors.push(problem(`${p}.evidence`, 'Expected observation, hypothesis, or conclusion.'));
      if (step.location === undefined) {
        if (depth > 1 && !(Array.isArray(step.children) && step.children.length)) errors.push(problem(`${p}.location`, 'Nested leaf steps require a source location.'));
      } else {
        const loc = step.location; const lp = `${p}.location`;
        if (!isRecord(loc)) errors.push(problem(lp, 'Expected a location object.'));
        else {
          unknownFields(loc, ['path', 'startLine', 'endLine', 'match'], lp, errors);
          if (!isRelativePath(loc.path)) errors.push(problem(`${lp}.path`, 'Expected a project-relative forward-slash path without escaping segments.'));
          if (!isInteger(loc.startLine, 1)) errors.push(problem(`${lp}.startLine`, 'Expected a 1-based positive integer.'));
          if (!isInteger(loc.endLine, 1)) errors.push(problem(`${lp}.endLine`, 'Expected a 1-based positive integer.'));
          if (isInteger(loc.startLine, 1) && isInteger(loc.endLine, 1) && (loc.endLine < loc.startLine || loc.endLine - loc.startLine + 1 > LIMITS.locationLines)) errors.push(problem(lp, `Range must be ordered and span at most ${LIMITS.locationLines} lines.`));
          if (loc.match !== undefined && (typeof loc.match !== 'string' || loc.match.length > LIMITS.match)) errors.push(problem(`${lp}.match`, `Expected exact text of at most ${LIMITS.match} characters.`));
        }
      }
      // Bound traversal even for hostile deeply nested JSON.
      if (step.children !== undefined) {
        if (depth <= LIMITS.depth) visit(step.children, `${p}.children`, depth + 1);
        else errors.push(problem(`${p}.children`, `Maximum depth is ${LIMITS.depth}.`));
      }
    });
  }
  visit(value.steps, 'steps', 1);
  if (count > LIMITS.steps) errors.push(problem('steps', `Maximum step count is ${LIMITS.steps}.`));
  return errors.length ? { ok: false, errors } : { ok: true, value: value as unknown as Input, errors: [] };
}
