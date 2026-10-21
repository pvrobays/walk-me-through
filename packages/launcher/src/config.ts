// The single swap point for launcher help targets and labels. Store or release URLs replace these later.
export const REPOSITORY_URL = 'https://github.com/pvrobays/walk-me-through';

export type Ide = 'vscode' | 'rider';
export const IDES: Ide[] = ['vscode', 'rider'];

export const IDE_CONFIG: Record<Ide, { label: string; install: string }> = {
  vscode: { label: 'VS Code', install: `${REPOSITORY_URL}#install-the-vs-code-extension` },
  rider: { label: 'Rider', install: `${REPOSITORY_URL}#install-the-rider-plugin` },
};

/** Browser-local storage key; it only ever holds "vscode" or "rider". */
export const PREFERENCE_KEY = 'walk-me-through.ide';
