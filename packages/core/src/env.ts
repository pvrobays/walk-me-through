import type { Environment } from './artifact';
import type { Problem, Validation } from './validation';

export interface EnvironmentHost {
  nodeVersion: string;
  platform: string;
  env: Record<string, string | undefined>;
  exists: (path: string) => boolean;
  readText: (path: string) => string;
}

export function checkEnvironment(host: EnvironmentHost): Validation<Environment> {
  const fail = (code: string, message: string, hint: string): Validation<Environment> => ({ ok: false, errors: [{ code, path: '$', message, hint, recovery: 'fix-environment' } satisfies Problem] });
  if (Number.parseInt(host.nodeVersion.replace(/^v/, '').split('.')[0], 10) < 20 || !/^v?\d+\./.test(host.nodeVersion)) {
    return fail('NODE_VERSION_UNSUPPORTED', `Node 20 or later is required; found ${host.nodeVersion}.`, 'Install Node 20 or later and make node available to the agent, then publish after fixing the environment.');
  }
  let procVersion = '';
  if (host.platform === 'linux') { try { procVersion = host.readText('/proc/version'); } catch { /* Not all Linux hosts expose procfs. */ } }
  let unsupported: string | undefined;
  if (host.env.WSL_DISTRO_NAME || /microsoft/i.test(procVersion)) unsupported = 'WSL';
  else if (host.env.container || host.exists('/.dockerenv') || host.exists('/run/.containerenv')) unsupported = 'container';
  else if (host.env.SSH_CONNECTION || host.env.SSH_CLIENT || host.env.SSH_TTY) unsupported = 'SSH';
  else if (!['win32', 'linux', 'darwin'].includes(host.platform)) unsupported = host.platform;
  const override = host.env.WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT === '1';
  if (unsupported && !override) return fail('ENVIRONMENT_UNSUPPORTED', `Unsupported execution environment: ${unsupported}. Walk Me Through needs a local desktop: native Windows, Linux or macOS, excluding WSL, SSH, and containers.`, 'Run on a local desktop (native Windows, Linux or macOS) with Node 20+. Report this setup blocker instead of retrying unchanged input.');
  return { ok: true, value: { kind: unsupported ?? 'local', platform: host.platform, unsupportedOverride: override }, errors: [] };
}
