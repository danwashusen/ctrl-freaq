import { enableMapSet } from 'immer';

// Document editor stores mutate Map/Set instances via Immer; enable plugin once per runtime.
let mapSetEnabled = false;

export function ensureImmerPlugins() {
  if (mapSetEnabled) {
    return;
  }

  enableMapSet();
  mapSetEnabled = true;
}

ensureImmerPlugins();
