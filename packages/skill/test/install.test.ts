import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it('installs, protects modified skill files, accepts CRLF copies, and overwrites only when forced', () => {
  const project = mkdtempSync(path.join(tmpdir(), 'wmt-install-'));
  const run = (force = false) => spawnSync(process.execPath, ['scripts/install-skill.mjs', project, ...(force ? ['--force'] : [])], { encoding: 'utf8' });
  try {
    expect(run().status).toBe(0);
    const target = path.join(project, '.agents/skills/walk-me-through/SKILL.md');
    const original = readFileSync(target, 'utf8');
    writeFileSync(target, original.replace(/\n/g, '\r\n')); expect(run().status).toBe(0);
    writeFileSync(target, 'Customized skill'); const refused = run();
    expect(refused.status).toBe(1); expect(refused.stderr).toContain('SKILL.md');
    expect(readFileSync(target, 'utf8')).toBe('Customized skill');
    expect(run(true).status).toBe(0); expect(readFileSync(target, 'utf8')).toBe(original);
    expect(JSON.parse(readFileSync(path.join(path.dirname(target), 'manifest.json'), 'utf8')).manifestVersion).toBe(1);
  } finally { rmSync(project, { recursive: true, force: true }); }
});
