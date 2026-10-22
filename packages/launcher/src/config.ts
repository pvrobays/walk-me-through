// The single swap point for launcher help targets and labels.
export const REPOSITORY_URL = 'https://github.com/pvrobays/walk-me-through';
export const VSCODE_MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through';
export const JETBRAINS_MARKETPLACE_URL = 'https://plugins.jetbrains.com/plugin/35375-walk-me-through';

export type Ide = 'vscode' | 'rider';
export const IDES: Ide[] = ['vscode', 'rider'];

export const IDE_CONFIG: Record<Ide, { label: string; install: string }> = {
  vscode: { label: 'VS Code', install: VSCODE_MARKETPLACE_URL },
  rider: { label: 'Rider', install: JETBRAINS_MARKETPLACE_URL },
};

/** Browser-local storage key; it only ever holds "vscode" or "rider". */
export const PREFERENCE_KEY = 'walk-me-through.ide';
