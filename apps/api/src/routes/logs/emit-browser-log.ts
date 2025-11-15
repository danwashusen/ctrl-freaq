import type { Logger } from 'pino';

import type { EnrichedBrowserLogEvent } from './enrich-log-entry.js';

export function emitBrowserLog(logger: Logger | undefined, event: EnrichedBrowserLogEvent): void {
  if (!logger) {
    return;
  }

  const message = `Browser log entry ingested (level=${event.level})`;
  switch (event.level) {
    case 'DEBUG':
      logger.debug(event, message);
      return;
    case 'INFO':
      logger.info(event, message);
      return;
    case 'WARN':
      logger.warn(event, message);
      return;
    case 'ERROR':
      logger.error(event, message);
      return;
    case 'FATAL':
      logger.fatal(event, message);
      return;
    default:
      logger.info(event, message);
  }
}
