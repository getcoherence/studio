export const SHORTCUT_ACTIONS = [
  'addZoom',
  'addTrim',
  'addAnnotation',
  'addKeyframe',
  'deleteSelected',
  'playPause',
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export interface ShortcutBinding {
  key: string;
  /** Maps to Cmd on macOS, Ctrl on Windows/Linux */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutsConfig = Record<ShortcutAction, ShortcutBinding>;

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  addZoom:        { key: 'z' },
  addTrim:        { key: 't' },
  addAnnotation:  { key: 'a' },
  addKeyframe:    { key: 'f' },
  deleteSelected: { key: 'd', ctrl: true },
  playPause:      { key: ' ' },
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  addZoom:        'Add Zoom',
  addTrim:        'Add Trim',
  addAnnotation:  'Add Annotation',
  addKeyframe:    'Add Keyframe',
  deleteSelected: 'Delete Selected',
  playPause:      'Play / Pause',
};

export function matchesShortcut(
  e: KeyboardEvent,
  binding: ShortcutBinding,
  isMacPlatform: boolean,
): boolean {
  if (e.key.toLowerCase() !== binding.key.toLowerCase()) return false;

  const primaryMod = isMacPlatform ? e.metaKey : e.ctrlKey;
  if (primaryMod !== !!binding.ctrl) return false;
  if (e.shiftKey !== !!binding.shift) return false;
  if (e.altKey !== !!binding.alt) return false;

  return true;
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space', 'delete': 'Del', 'backspace': '⌫', 'escape': 'Esc',
  'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→',
};

export function formatBinding(binding: ShortcutBinding, isMac: boolean): string {
  const parts: string[] = [];
  if (binding.ctrl)  parts.push(isMac ? '⌘' : 'Ctrl');
  if (binding.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (binding.alt)   parts.push(isMac ? '⌥' : 'Alt');
  parts.push(KEY_LABELS[binding.key] ?? binding.key.toUpperCase());
  return parts.join(' + ');
}

export function mergeWithDefaults(partial: Partial<ShortcutsConfig>): ShortcutsConfig {
  const merged = { ...DEFAULT_SHORTCUTS };
  for (const action of SHORTCUT_ACTIONS) {
    if (partial[action]) {
      merged[action] = partial[action] as ShortcutBinding;
    }
  }
  return merged;
}
