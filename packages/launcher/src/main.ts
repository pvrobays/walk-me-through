// DOM rendering for the launcher. Envelope values are only ever assigned through textContent or href
// (IDE URIs built by core), never parsed as markup. Nothing navigates without a click on a real link.
import { IDE_CONFIG, IDES, PREFERENCE_KEY, REPOSITORY_URL, type Ide } from './config';
import { parsePreference, viewFromFragment, type LaunchView } from './model';

/** The minimal DOM surface the renderer uses, so tests can supply plain objects. */
export interface Element {
  textContent: string | null;
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  classList: { toggle(name: string, force?: boolean): unknown };
  replaceChildren(...nodes: Element[]): void;
}
export interface Dom {
  getElementById(id: string): Element | null;
  createElement(tag: 'li'): Element;
}

function byId(dom: Dom, id: string): Element {
  const element = dom.getElementById(id);
  if (!element) throw new Error(`Launcher markup is missing #${id}`);
  return element;
}
function link(element: Element, href: string | undefined): void {
  if (href === undefined) element.removeAttribute('href');
  else element.setAttribute('href', href);
}

function emphasize(dom: Dom, ide: Ide | undefined): void {
  for (const other of IDES) {
    const choice = byId(dom, `open-${other}`);
    choice.classList.toggle('preferred', other === ide);
    if (other === ide) choice.setAttribute('aria-describedby', 'status');
    else choice.removeAttribute('aria-describedby');
  }
}

export function render(view: LaunchView, dom: Dom, preference: Ide | undefined): void {
  const ready = view.state === 'ready';
  byId(dom, 'heading').textContent = view.heading;
  byId(dom, 'message').textContent = view.message;
  for (const id of ['details', 'choices', 'fallback']) byId(dom, id).hidden = !ready;
  for (const ide of IDES) {
    byId(dom, `help-${ide}`).hidden = true;
    const href = ready ? view.hrefs?.[ide] : undefined;
    link(byId(dom, `open-${ide}`), href);
    link(byId(dom, `retry-${ide}`), href);
    const install = byId(dom, `install-${ide}`);
    install.setAttribute('href', IDE_CONFIG[ide].install);
    install.setAttribute('target', '_blank');
    install.setAttribute('rel', 'noopener noreferrer');
  }
  emphasize(dom, ready ? preference : undefined);
  const about = byId(dom, 'about');
  about.setAttribute('href', REPOSITORY_URL);
  about.setAttribute('rel', 'noopener noreferrer');
  byId(dom, 'title').textContent = view.title ?? '';
  byId(dom, 'id').textContent = view.id ?? '';
  byId(dom, 'copy-text').textContent = view.id ?? '';
  byId(dom, 'root').textContent = view.root ?? '';
  byId(dom, 'step').textContent = view.step ?? '';
  byId(dom, 'step-label').hidden = view.step === undefined;
  byId(dom, 'step-value').hidden = view.step === undefined;
  byId(dom, 'status').textContent = ready && preference ? `Last time you chose ${IDE_CONFIG[preference].label}.` : '';
  byId(dom, 'copy-status').textContent = '';
  const items = view.problems.map(problem => {
    const item = dom.createElement('li');
    item.textContent = `${problem.path}: ${problem.message}`;
    return item;
  });
  byId(dom, 'problem-list').replaceChildren(...items);
  byId(dom, 'problems').hidden = items.length === 0;
}

/** Shows the chosen IDE's help and retry next to the choices. The link itself performs the launch. */
export function chosen(dom: Dom, ide: Ide): void {
  for (const other of IDES) byId(dom, `help-${other}`).hidden = other !== ide;
  emphasize(dom, ide);
  byId(dom, 'status').textContent = `Asked your browser to open ${IDE_CONFIG[ide].label}. If nothing happened, see the help below.`;
}

function readPreference(): Ide | undefined {
  try { return parsePreference(window.localStorage.getItem(PREFERENCE_KEY)); } catch { return undefined; }
}
function savePreference(ide: Ide): void {
  try { window.localStorage.setItem(PREFERENCE_KEY, ide); } catch { /* storage may be disabled */ }
}

function start(): void {
  const dom = document as unknown as Dom;
  const update = () => render(viewFromFragment(window.location.hash), dom, readPreference());
  for (const ide of IDES) {
    for (const id of [`open-${ide}`, `retry-${ide}`]) {
      document.getElementById(id)?.addEventListener('click', () => {
        // Leave the default navigation in place: the click is the user gesture that opens the IDE URI.
        savePreference(ide);
        chosen(dom, ide);
      });
    }
  }
  document.getElementById('copy-id')?.addEventListener('click', () => {
    const id = document.getElementById('id')?.textContent ?? '';
    const status = document.getElementById('copy-status')!;
    const fallback = () => {
      const text = document.getElementById('copy-text')!;
      const range = document.createRange();
      range.selectNodeContents(text);
      const selection = window.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range);
      status.textContent = 'Copying is not available here. The ID is selected; press Ctrl+C (⌘C on macOS) to copy it.';
    };
    if (!navigator.clipboard?.writeText) { fallback(); return; }
    navigator.clipboard.writeText(id).then(() => { status.textContent = `Copied ${id}.`; }, fallback);
  });
  window.addEventListener('hashchange', update);
  update();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') start();
