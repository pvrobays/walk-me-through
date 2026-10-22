import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildEnvelope, encodeEnvelope, riderUri, vscodeUri, type LaunchEnvelope } from '../../core/src/launch';
import { IDE_CONFIG, PREFERENCE_KEY, REPOSITORY_URL } from '../src/config';
import { parsePreference, viewFromFragment } from '../src/model';
import { chosen, render, type Dom, type Element } from '../src/main';

const id = '20261021T143005123Z-abcdef';
const envelope = (extra: Partial<LaunchEnvelope> = {}): LaunchEnvelope => ({ v: 1, root: 'C:\\Users\\Jürgen\\repo', env: { kind: 'local', platform: 'win32' }, id, ...extra });

describe('viewFromFragment', () => {
  it('offers both IDE URIs built by core for a valid fragment', () => {
    const encoded = encodeEnvelope(envelope({ title: 'Retry flow', step: 's2' }));
    const view = viewFromFragment('#' + encoded);
    expect(view).toMatchObject({ state: 'ready', title: 'Retry flow', id, root: 'C:\\Users\\Jürgen\\repo', step: 's2', problems: [] });
    expect(view.hrefs).toEqual({ vscode: vscodeUri(encoded), rider: riderUri(encoded) });
    expect(view.hrefs!.vscode).toBe(`vscode://pvrobays.walk-me-through/open?e=${encoded}`);
    expect(view.hrefs!.rider).toBe(`jetbrains://rider/walkmethrough/open?e=${encoded}`);
    expect(viewFromFragment(encoded).hrefs).toEqual(view.hrefs);
  });
  it('matches builder output for a published-style envelope and falls back to the ID without a title', () => {
    const built = buildEnvelope({ id, title: 'T'.repeat(200), project: { root: '/home/me/repo', environment: { kind: 'local', platform: 'linux', unsupportedOverride: false } } });
    expect(built.ok).toBe(true); if (!built.ok) return;
    expect(viewFromFragment('#' + built.encoded)).toMatchObject({ state: 'ready', title: built.envelope.title, hrefs: { vscode: vscodeUri(built.encoded) } });
    expect(viewFromFragment('#' + encodeEnvelope(envelope()))).toMatchObject({ title: id });
    expect(viewFromFragment('#' + encodeEnvelope(envelope({ title: '  ' })))).toMatchObject({ title: id });
    expect(viewFromFragment('#' + encodeEnvelope(envelope()))).not.toHaveProperty('step');
  });
  it('explains missing, malformed, invalid, oversized and newer links without IDE choices', () => {
    const cases: [string, string][] = [
      ['', 'missing'], ['#', 'missing'],
      ['#not*base64', 'invalid'], ['#' + encodeEnvelope(envelope()).slice(0, 30), 'invalid'],
      ['#' + encodeEnvelope({ ...envelope(), id: '../../etc/passwd' }), 'invalid'],
      ['#' + 'A'.repeat(1540), 'too-long'],
      ['#' + Buffer.from(JSON.stringify({ v: 2, anything: true })).toString('base64url'), 'newer'],
    ];
    for (const [hash, state] of cases) {
      const view = viewFromFragment(hash);
      expect(view.state, hash.slice(0, 20)).toBe(state);
      expect(view).not.toHaveProperty('hrefs');
      expect(view.message).toMatch(state === 'newer' ? /newer Walk Me Through/ : /fresh walkthrough link/);
    }
  });
  it('only accepts the two known preferences', () => {
    expect(parsePreference('rider')).toBe('rider'); expect(parsePreference('vscode')).toBe('vscode');
    for (const value of [null, undefined, '', 'Rider', '{"root":"C:\\\\"}']) expect(parsePreference(value)).toBeUndefined();
    expect(PREFERENCE_KEY).toBe('walk-me-through.ide');
  });
});

class FakeElement implements Element {
  textContent: string | null = '';
  hidden = false;
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: FakeElement[] = [];
  innerHTMLWrites = 0;
  set innerHTML(_: string) { this.innerHTMLWrites++; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  classList = { toggle: (name: string, force?: boolean) => { if (force ?? !this.classes.has(name)) this.classes.add(name); else this.classes.delete(name); } };
  replaceChildren(...nodes: Element[]) { this.children = nodes as FakeElement[]; }
}
function fakeDom() {
  const html = readFileSync('launcher/index.html', 'utf8');
  const elements = new Map<string, FakeElement>();
  for (const [, name] of html.matchAll(/\sid="([^"]+)"/g)) elements.set(name, new FakeElement());
  const dom: Dom = { getElementById: name => elements.get(name) ?? null, createElement: () => new FakeElement() };
  return { dom, el: (name: string) => elements.get(name)! };
}

describe('render', () => {
  it('keeps markup in the title as literal text and fills hrefs only after validation', () => {
    const markup = '<img src=x onerror=alert(1)>';
    const encoded = encodeEnvelope(envelope({ title: markup }));
    const { dom, el } = fakeDom();
    render(viewFromFragment('#' + encoded), dom, undefined);
    expect(el('title').textContent).toBe(markup);
    expect([...['title', 'id', 'root', 'heading', 'message']].every(name => el(name).innerHTMLWrites === 0)).toBe(true);
    expect(el('open-vscode').attributes.get('href')).toBe(vscodeUri(encoded));
    expect(el('retry-rider').attributes.get('href')).toBe(riderUri(encoded));
    expect(el('install-vscode').attributes.get('href')).toBe(IDE_CONFIG.vscode.install);
    expect(el('install-rider').attributes.get('href')).toBe(IDE_CONFIG.rider.install);
    expect(el('about').attributes.get('href')).toBe(REPOSITORY_URL);
    expect(el('details').hidden || el('choices').hidden || el('fallback').hidden).toBe(false);
    expect(el('help-vscode').hidden && el('help-rider').hidden).toBe(true);
    expect(el('step-label').hidden).toBe(true);
    expect(el('copy-text').textContent).toBe(id);
  });
  it('emphasizes the remembered IDE without launching, then shows only the chosen help', () => {
    const { dom, el } = fakeDom();
    render(viewFromFragment('#' + encodeEnvelope(envelope({ step: 's1' }))), dom, 'rider');
    expect(el('open-rider').classes.has('preferred')).toBe(true);
    expect(el('open-vscode').classes.has('preferred')).toBe(false);
    expect(el('open-vscode').attributes.has('href') && el('open-rider').attributes.has('href')).toBe(true);
    expect(el('step-value').hidden).toBe(false);
    chosen(dom, 'vscode');
    expect(el('help-vscode').hidden).toBe(false); expect(el('help-rider').hidden).toBe(true);
    expect(el('open-vscode').classes.has('preferred')).toBe(true);
    expect(el('status').textContent).toContain('VS Code');
  });
  it('removes IDE links and shows problems when a fragment changes to an invalid one', () => {
    const { dom, el } = fakeDom();
    render(viewFromFragment('#' + encodeEnvelope(envelope())), dom, 'vscode');
    render(viewFromFragment('#' + encodeEnvelope({ ...envelope(), root: 'relative' })), dom, 'vscode');
    for (const name of ['open-vscode', 'open-rider', 'retry-vscode', 'retry-rider']) expect(el(name).attributes.has('href')).toBe(false);
    expect(el('choices').hidden && el('details').hidden && el('fallback').hidden).toBe(true);
    expect(el('open-vscode').classes.has('preferred')).toBe(false);
    expect(el('problems').hidden).toBe(false);
    expect(el('problem-list').children.map(child => child.textContent)).toEqual(['root: Expected an absolute Windows or POSIX project root.']);
  });
});

describe('static assets', () => {
  it('points install help at the two store pages and keeps README links resolvable', () => {
    // GitHub heading anchors: lowercase, drop punctuation except hyphens/underscores, spaces become hyphens.
    const slugs = (file: string) => new Set([...readFileSync(file, 'utf8').matchAll(/^#{1,6} (.+)$/gm)]
      .map(match => match[1].trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-')));
    expect(IDE_CONFIG.vscode.install).toBe('https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through');
    expect(IDE_CONFIG.rider.install).toBe('https://plugins.jetbrains.com/plugin/35375-walk-me-through');
    // The README keeps its install headings, which lead with the same store links.
    const readme = slugs('README.md');
    for (const heading of ['install-the-vs-code-extension', 'install-the-rider-plugin', 'development-builds']) expect(readme.has(heading), heading).toBe(true);
    const text = readFileSync('README.md', 'utf8');
    for (const ide of ['vscode', 'rider'] as const) expect(text).toContain(`(${IDE_CONFIG[ide].install})`);
    for (const [, file, anchor] of text.matchAll(/\]\((packages\/rider\/README\.md|)#([a-z0-9-]+)\)/g)) {
      expect(slugs(file || 'README.md').has(anchor), `${file}#${anchor}`).toBe(true);
    }
    expect(REPOSITORY_URL).toBe('https://github.com/pvrobays/walk-me-through');
  });
  const html = readFileSync('launcher/index.html', 'utf8');
  it('states the platform status instead of a Windows-only Rider line', () => {
    expect(html).not.toMatch(/Windows only/i);
    expect(html.match(/native Windows, Linux or macOS \(Linux and macOS are not verified by the maintainers\)/g)).toHaveLength(2);
    expect(html).toContain('Install Walk Me Through from the VS Code Marketplace');
    expect(html).toContain('Install Walk Me Through from JetBrains Marketplace');
  });
  it('declares the restrictive CSP and no-referrer policy', () => {
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'">`);
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
  });
  it('references only same-origin relative assets and contains no inline script, style or handlers', () => {
    const refs = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map(match => match[1]);
    expect(refs.sort()).toEqual(['data:,', 'launcher.js', 'styles.css']);
    expect(html).toContain('<link rel="icon" href="data:,">');
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
    expect(html).not.toMatch(/<style|\sstyle="|\son[a-z]+=/i);
    const css = readFileSync('launcher/styles.css', 'utf8');
    expect(css).not.toMatch(/@import|url\(/);
  });
  it('ships a bundle without markup sinks, timers, script navigation or network APIs', () => {
    const js = readFileSync('launcher/launcher.js', 'utf8');
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|location\.(assign|replace)|location\.href\s*=|window\.open|setTimeout|setInterval|import\(/);
    // The only URLs in the bundle: the repository (About) and the two store pages (install help).
    const urls = [...js.matchAll(/https?:\/\/[^\s"'`]+/g)].map(match => match[0]).sort();
    expect(urls).toEqual(['https://github.com/pvrobays/walk-me-through', 'https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through', 'https://plugins.jetbrains.com/plugin/35375-walk-me-through']);
  });
});
