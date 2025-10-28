/**
 * Drops stdout console output during Vitest runs unless VITEST_DEBUG=1.
 * Allows retaining verbose logs when explicitly requested.
 */
const DEBUG_FLAG = '1';

export function createConsoleSilencer() {
  const isDebugEnabled = process.env.VITEST_DEBUG === DEBUG_FLAG;

  return {
    onConsoleLog(_log: string, type: 'stdout' | 'stderr') {
      if (isDebugEnabled) {
        return;
      }

      if (type === 'stdout') {
        return false;
      }
    },
  };
}
