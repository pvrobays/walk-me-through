import * as fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { captureAnchor } from './anchor';
import { validateArtifact, type Artifact, type Environment, type Step } from './artifact';
import { stepId, walkthroughId } from './ids';
import { validateInput, type InputStep } from './input';
import { LIMITS } from './limits';
import { resolveSelection } from './selection';
import { decodeText } from './text';
import { problem, type Problem } from './validation';

export interface PublishIO {
  realpath: (name: string) => string;
  read: (name: string) => Uint8Array;
  size: (name: string) => number;
  exists: (name: string) => boolean;
  mkdir: (name: string) => void;
  writeExclusive: (name: string, text: string) => void;
  rename: (from: string, to: string) => void;
  remove: (name: string) => void;
  git: (root: string) => Artifact['source']['git'];
}
export const nodeIO: PublishIO = {
  realpath: name => fs.realpathSync.native(name), read: name => fs.readFileSync(name),
  size: name => fs.statSync(name).size, exists: name => fs.existsSync(name),
  mkdir: name => { fs.mkdirSync(name, { recursive: true }); },
  writeExclusive: (name, text) => fs.writeFileSync(name, text, { flag: 'wx', encoding: 'utf8' }),
  rename: (from, to) => fs.renameSync(from, to), remove: name => fs.rmSync(name, { force: true }),
  git: root => {
    try {
      const run = (args: string[]) => execFileSync('git', args, { cwd: root, timeout: 2000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return { commit: run(['rev-parse', 'HEAD']), dirty: run(['status', '--porcelain']).length > 0 };
    } catch { return null; }
  },
};
export interface PublishOptions {
  scriptPath: string;
  root?: string;
  cwd: string;
  platform: string;
  environment: Environment;
  bundleVersion: string;
  io?: PublishIO;
  clock?: () => Date;
  makeId?: () => string;
}
export interface PublishSuccess {
  ok: true; id: string; artifactPath: string; stepCount: number;
  warnings: { code: 'non-unique-anchor'; stepId: string; path: string }[];
  open: string;
}
export interface PublishFailure { ok: false; errors: Problem[]; exitCode: 1 | 2 }
export type PublishResult = PublishSuccess | PublishFailure;

export function resolveRoot(options: Pick<PublishOptions, 'scriptPath' | 'root' | 'cwd' | 'platform'>, io: PublishIO): string {
  if (options.root) return io.realpath(path.resolve(options.cwd, options.root));
  const script = io.realpath(options.scriptPath);
  const directory = path.dirname(script);
  const suffix = path.join('.agents', 'skills', 'walk-me-through', 'scripts');
  const compared = options.platform === 'win32' ? directory.toLowerCase() : directory;
  if (!compared.endsWith(path.sep + suffix)) throw new Error('Use the installed .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs or supply --root <projectDir>.');
  return io.realpath(directory.slice(0, -(suffix.length + 1)) || path.parse(directory).root);
}

export function publish(inputValue: unknown, options: PublishOptions): PublishResult {
  const io = options.io ?? nodeIO;
  const fail = (errors: Problem[], exitCode: 1 | 2 = 1): PublishFailure => ({ ok: false, errors, exitCode });
  let root: string;
  try { root = resolveRoot(options, io); }
  catch (error) { return fail([problem('$', String(error), 'ROOT_NOT_RESOLVED', 'Correct --root or invoke the installed script, then retry after correction.')], 2); }
  const input = validateInput(inputValue);
  if (!input.ok) return fail(input.errors);
  const errors: Problem[] = [];
  const steps: Step[] = [];
  const warnings: PublishSuccess['warnings'] = [];
  const cache = new Map<string, string>();
  function flatten(items: InputStep[], parentId: string | null, field: string): void {
    items.forEach((item, index) => {
      const p = `${field}[${index}]`; const id = stepId(steps.length);
      const step: Step = { id, parentId, title: item.title, explanation: item.explanation, ...(item.evidence ? { evidence: item.evidence } : {}) };
      steps.push(step);
      if (item.location) {
        const location = item.location;
        const details = { sourcePath: location.path, startLine: location.startLine, endLine: location.endLine };
        try {
          const resolved = io.realpath(path.join(root, ...location.path.split('/')));
          const relative = path.relative(root, resolved);
          if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
            errors.push({ ...problem(`${p}.location.path`, 'Source realpath escapes the project root.', 'SOURCE_OUTSIDE_ROOT', 'Choose a source file inside the project root, including after following symlinks.'), details });
          } else if (io.size(resolved) > LIMITS.sourceBytes) {
            errors.push({ ...problem(`${p}.location.path`, `Source file exceeds ${LIMITS.sourceBytes} bytes.`, 'SOURCE_TOO_LARGE', 'Choose a smaller source file within the documented size limit.'), details });
          } else {
            let text = cache.get(resolved);
            if (text === undefined) { text = decodeText(io.read(resolved)); cache.set(resolved, text); }
            const selection = resolveSelection(location, text, `${p}.location`);
            if (!selection.ok) errors.push(...selection.errors);
            else {
              const anchor = captureAnchor(text, selection.value.range);
              step.location = { path: location.path, range: selection.value.range, anchor };
              if (!anchor.context.unique) warnings.push({ code: 'non-unique-anchor', stepId: id, path: `${p}.location` });
            }
          }
        } catch (error) {
          errors.push({ ...problem(`${p}.location.path`, `Cannot read source as UTF-8 text: ${String(error)}`, 'SOURCE_UNREADABLE', 'Re-read the current source, choose an existing UTF-8 text file inside the root, and correct the path before retrying.'), details });
        }
      }
      if (item.children) flatten(item.children, id, `${p}.children`);
    });
  }
  flatten(input.value.steps, null, 'steps');
  if (errors.length) return fail(errors);
  const clock = options.clock ?? (() => new Date());
  const makeId = options.makeId ?? (() => walkthroughId(clock));
  let git: Artifact['source']['git'] = null;
  try { git = io.git(root); } catch { /* Git is optional. */ }
  const artifact: Artifact = {
    schemaVersion: 1, generator: { name: 'walk-me-through', bundleVersion: options.bundleVersion },
    id: makeId(), createdAt: clock().toISOString(), title: input.value.title, summary: input.value.summary,
    project: { root, environment: options.environment }, source: { git }, steps,
  };
  const validated = validateArtifact(artifact);
  if (!validated.ok) return fail(validated.errors.map(error => ({ ...error, code: 'INTERNAL_ERROR', recovery: 'report', hint: 'Report this tool failure; do not fabricate an artifact or retry unchanged input repeatedly.' })), 2);
  const directory = path.join(root, '.walk-me-through', 'walkthroughs');
  try {
    io.mkdir(directory);
    const ignore = path.join(root, '.walk-me-through', '.gitignore');
    if (!io.exists(ignore)) {
      try { io.writeExclusive(ignore, '*\n'); } catch (error) { if (!io.exists(ignore)) throw error; }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) artifact.id = makeId();
      const final = path.join(directory, artifact.id + '.json');
      // Serialize writers for the same ID so rename cannot replace another publisher's artifact.
      const lock = final + '.lock';
      try { io.writeExclusive(lock, ''); }
      catch (error) { if (io.exists(lock)) continue; throw error; }
      const temporary = final + '.tmp-' + randomBytes(6).toString('hex');
      try {
        if (io.exists(final)) continue;
        io.writeExclusive(temporary, JSON.stringify(artifact, null, 2) + '\n');
        io.rename(temporary, final);
        return {
          ok: true, id: artifact.id, artifactPath: `.walk-me-through/walkthroughs/${artifact.id}.json`, stepCount: steps.length, warnings,
          open: `Run Walk Me Through: Open Walkthrough in VS Code and choose "${artifact.title}" (ID ${artifact.id}) in the picker.`,
        };
      } finally { io.remove(temporary); io.remove(lock); }
    }
    throw new Error('Unable to allocate a unique walkthrough ID after five attempts.');
  } catch (error) {
    return fail([{ code: 'ARTIFACT_WRITE_FAILED', path: '$', message: String(error), hint: 'Report the filesystem failure and check write permissions and free space before publishing again.', recovery: 'fix-environment' }], 2);
  }
}
