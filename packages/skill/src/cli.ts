import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from '@walk-me-through/core/env';
import { LIMITS } from '@walk-me-through/core/limits';
import { publish } from '@walk-me-through/core/publish';
import { decodeText } from '@walk-me-through/core/text';
import type { Problem } from '@walk-me-through/core/validation';

type Failure = { ok: false; errors: Problem[] };
function failure(code: string, message: string, hint: string, recovery: Problem['recovery'] = 'fix-input'): Failure {
  return { ok: false, errors: [{ code, path: '$', message, hint, recovery }] };
}

function main(): { result: object; exitCode: number } {
  const environment = checkEnvironment({
    nodeVersion: process.versions.node, platform: process.platform, env: process.env,
    exists: existsSync, readText: name => readFileSync(name, 'utf8'),
  });
  if (!environment.ok) return { result: { ok: false, errors: environment.errors }, exitCode: 2 };
  const args = process.argv.slice(2);
  let root: string | undefined;
  const usage = () => ({ result: failure('USAGE', 'Usage: publish-walkthrough.mjs <input.json> [--root <dir>]', 'Supply an input JSON file and optionally an explicit development project root, then retry after correction.'), exitCode: 2 });
  if (!args.length || args[0].startsWith('--')) return usage();
  if (args.length !== 1) {
    if (args.length !== 3 || args[1] !== '--root' || !args[2] || args[2].startsWith('--')) return usage();
    root = args[2];
  }
  const inputPath = path.resolve(args[0]);
  let bytes: Uint8Array;
  try {
    if (statSync(inputPath).size > LIMITS.inputBytes) return { result: failure('INPUT_TOO_LARGE', `Input exceeds ${LIMITS.inputBytes} bytes.`, 'Reduce the draft to fit the documented input size limit before retrying.'), exitCode: 1 };
    bytes = readFileSync(inputPath);
  } catch (error) {
    return { result: failure('INPUT_FILE_NOT_FOUND', `Cannot read input file ${inputPath}: ${String(error)}`, 'Correct the input path or file permissions before retrying.'), exitCode: 2 };
  }
  let value: unknown;
  try { value = JSON.parse(decodeText(bytes)); }
  catch (error) { return { result: failure('INVALID_JSON', `Input is not valid UTF-8 JSON: ${String(error)}`, 'Correct the JSON syntax or UTF-8 encoding before retrying.'), exitCode: 1 }; }
  const result = publish(value, {
    scriptPath: fileURLToPath(import.meta.url), root, cwd: process.cwd(), platform: process.platform,
    environment: environment.value, bundleVersion: '0.1.0',
  });
  if (!result.ok) return { result: { ok: false, errors: result.errors }, exitCode: result.exitCode };
  return { result, exitCode: 0 };
}

try {
  const { result, exitCode } = main();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = exitCode;
} catch (error) {
  process.stdout.write(JSON.stringify(failure('INTERNAL_ERROR', `Publishing failed internally: ${String(error)}`, 'Report this tool failure; do not fabricate an artifact or repeatedly retry unchanged input.', 'report')) + '\n');
  process.exitCode = 2;
}
