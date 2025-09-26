export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface MilkdownCommandMap {
  toggleBold: () => void;
  toggleItalic: () => void;
  insertLink: () => void;
}

export interface ShortcutBinding {
  shortcut: string;
  handler: ShortcutHandler;
}

export interface ShortcutConfig {
  commands: MilkdownCommandMap;
}

type ShortcutToken = 'mod' | 'ctrl' | 'meta' | 'shift' | 'alt' | string;

const normalizeCombo = (combo: string) => combo.trim().toLowerCase();

const parseCombo = (combo: string) => {
  const tokens = normalizeCombo(combo)
    .split('+')
    .map(token => token.trim()) as ShortcutToken[];
  if (tokens.length === 0) {
    throw new Error('Invalid shortcut combo');
  }

  const key = tokens[tokens.length - 1];
  const modifiers = tokens.slice(0, -1) as ShortcutToken[];

  return { key, modifiers };
};

const hasModifier = (tokens: ShortcutToken[], modifier: ShortcutToken) => tokens.includes(modifier);

export function isToggleShortcut(event: KeyboardEvent, combo: string): boolean {
  if (!event || typeof combo !== 'string') {
    return false;
  }

  const { key, modifiers } = parseCombo(combo);
  const eventKey = (event.key ?? '').toLowerCase();

  if (!key || eventKey !== key) {
    return false;
  }

  const requiresMod = hasModifier(modifiers, 'mod');
  const requiresCtrl = hasModifier(modifiers, 'ctrl');
  const requiresMeta = hasModifier(modifiers, 'meta');
  const requiresShift = hasModifier(modifiers, 'shift');
  const requiresAlt = hasModifier(modifiers, 'alt');

  if (requiresMod && !(event.ctrlKey || event.metaKey)) {
    return false;
  }
  if (!requiresMod && !requiresCtrl && event.ctrlKey) {
    return false;
  }
  if (!requiresMod && !requiresMeta && event.metaKey) {
    return false;
  }
  if (requiresCtrl && !event.ctrlKey) {
    return false;
  }
  if (requiresMeta && !event.metaKey) {
    return false;
  }
  if (requiresShift !== Boolean(event.shiftKey)) {
    return false;
  }
  if (requiresAlt !== Boolean(event.altKey)) {
    return false;
  }

  return true;
}

export function createShortcutHandlers(config: ShortcutConfig): ShortcutBinding[] {
  const { commands } = config;

  const bindings: Array<{ combo: string; invoke: () => void }> = [
    { combo: 'mod+b', invoke: commands.toggleBold },
    { combo: 'mod+i', invoke: commands.toggleItalic },
    { combo: 'mod+k', invoke: commands.insertLink },
  ];

  return bindings.map(({ combo, invoke }) => ({
    shortcut: combo,
    handler: event => {
      if (isToggleShortcut(event, combo)) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        invoke();
      }
    },
  }));
}
