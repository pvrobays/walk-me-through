import { expect, it } from 'vitest';
import { checkEnvironment, type EnvironmentHost } from '../src/env';

const host = (overrides: Partial<EnvironmentHost> = {}): EnvironmentHost => ({ nodeVersion: '24.16.0', platform: 'linux', env: {}, exists: () => false, readText: () => 'Linux native', ...overrides });
it('accepts native Windows and Linux without overrides', () => {
  for (const platform of ['win32', 'linux']) expect(checkEnvironment(host({ platform }))).toMatchObject({ ok: true, value: { kind: 'local', platform, unsupportedOverride: false } });
});
it('detects WSL, containers, SSH on either platform, and other platforms', () => {
  const cases: [Partial<EnvironmentHost>, string][] = [
    [{ env: { WSL_DISTRO_NAME: 'Ubuntu' } }, 'WSL'], [{ readText: () => 'Microsoft WSL2' }, 'WSL'],
    [{ exists: p => p === '/.dockerenv' }, 'container'], [{ exists: p => p === '/run/.containerenv' }, 'container'],
    [{ env: { container: 'podman' } }, 'container'], [{ platform: 'darwin' }, 'darwin'],
  ];
  for (const platform of ['win32', 'linux']) for (const key of ['SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY']) cases.push([{ platform, env: { [key]: 'session' } }, 'SSH']);
  for (const [overrides, name] of cases) expect(checkEnvironment(host(overrides))).toMatchObject({ ok: false, errors: [{ code: 'ENVIRONMENT_UNSUPPORTED', message: expect.stringContaining(name), recovery: 'fix-environment', hint: expect.stringContaining('native Windows or native Linux') }] });
});
it('checks Node before environment detection, and the override never bypasses Node requirements', () => {
  expect(checkEnvironment(host({ nodeVersion: '18.0.0', exists: () => { throw new Error('must not run'); }, env: { WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT: '1' } }))).toMatchObject({ ok: false, errors: [{ code: 'NODE_VERSION_UNSUPPORTED', message: expect.stringContaining('Node 20'), recovery: 'fix-environment' }] });
  expect(checkEnvironment(host({ platform: 'darwin', env: { WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT: '1' } }))).toMatchObject({ ok: true, value: { platform: 'darwin', unsupportedOverride: true } });
});
