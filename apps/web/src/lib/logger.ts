interface LogLevel {
  DEBUG: 10;
  INFO: 20;
  WARN: 30;
  ERROR: 40;
  FATAL: 50;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50,
};

const resolvedEnv = ((): { DEV?: boolean; VITE_API_BASE_URL?: string } => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env === 'object') {
    return import.meta.env as { DEV?: boolean; VITE_API_BASE_URL?: string };
  }
  return { DEV: false };
})();

interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LoggerOptions {
  level?: keyof LogLevel;
  apiBaseUrl?: string;
  batchSize?: number;
  flushInterval?: number;
  enableRemoteLogging?: boolean;
}

class BrowserLogger {
  private level: number;
  private apiBaseUrl: string;
  private batchSize: number;
  private flushInterval: number;
  private enableRemoteLogging: boolean;
  private logQueue: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;
  private baseSessionId: string;
  private currentRequestId?: string;
  private templateContext?: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.level = LOG_LEVELS[options.level || 'INFO'];
    this.apiBaseUrl =
      options.apiBaseUrl || resolvedEnv.VITE_API_BASE_URL || 'http://localhost:5001';
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 5000; // 5 seconds
    this.enableRemoteLogging = options.enableRemoteLogging !== false;
    this.sessionId = this.generateSessionId();
    this.baseSessionId = this.sessionId;

    if (this.enableRemoteLogging && typeof window !== 'undefined') {
      this.startFlushTimer();

      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });

      window.addEventListener('pagehide', () => {
        this.flush(true);
      });
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRequestId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private createLogEntry(
    level: keyof LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.currentRequestId || this.generateRequestId(),
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    if (context) {
      entry.context = { ...this.templateContext, ...context };
    } else if (this.templateContext) {
      entry.context = { ...this.templateContext };
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(
    level: keyof LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ) {
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, error);

    const logMethod = level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error';
    // Development console output
    if (import.meta.env.DEV) {
      const c = console as unknown as Partial<
        Record<'debug' | 'info' | 'warn' | 'error' | 'log', (...args: unknown[]) => void>
      >;
      const consoleMethod = c[logMethod] ?? console.log.bind(console);
      consoleMethod(
        `[${level}] ${message}`,
        context && Object.keys(context).length > 0 ? context : '',
        error || ''
      );
    }

    if (this.enableRemoteLogging) {
      this.logQueue.push(entry);

      if (this.logQueue.length >= this.batchSize) {
        this.flush();
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('WARN', message, context);
  }

  error(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log('ERROR', message, context, error);
  }

  fatal(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log('FATAL', message, context, error);
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(sync = false) {
    if (this.logQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    const payload = {
      logs: logsToSend,
      source: 'browser',
      sessionId: this.sessionId,
    };

    try {
      const sendLogs = async () => {
        await fetch(`${this.apiBaseUrl}/api/v1/logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      };

      if (sync && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(`${this.apiBaseUrl}/api/v1/logs`, JSON.stringify(payload));
      } else {
        await sendLogs();
      }
    } catch (error) {
      // Fallback: only log to console in dev when remote logging fails
      if (import.meta.env.DEV) {
        console.warn('Failed to send logs to server:', error);
      }

      if (this.logQueue.length < 100) {
        this.logQueue.unshift(...logsToSend);
      }
    }
  }

  setUserId(userId: string) {
    this.sessionId = `${this.generateSessionId()}-${userId}`;
    this.baseSessionId = this.sessionId;
  }

  setLevel(level: keyof LogLevel) {
    this.level = LOG_LEVELS[level];
  }

  setCorrelation(input: { requestId?: string; sessionId?: string }) {
    if (input.requestId) {
      this.currentRequestId = input.requestId;
    }

    if (input.sessionId) {
      this.sessionId = `${this.baseSessionId}-${input.sessionId}`;
    }
  }

  setTemplateContext(context: {
    templateId: string;
    templateVersion?: string;
    templateSchemaHash?: string;
  }) {
    this.templateContext = { ...context };
  }

  clearTemplateContext() {
    this.templateContext = undefined;
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(true);
  }
}

export const logger = new BrowserLogger({
  level: resolvedEnv.DEV ? 'DEBUG' : 'INFO',
  enableRemoteLogging: !resolvedEnv.DEV, // Only log to server in production
});

export default logger;
export { BrowserLogger };
export type { LogEntry, LoggerOptions };
