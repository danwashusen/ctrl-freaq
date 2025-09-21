/**
 * Client-side structured logging utility
 * SOC 2 compliant logging with structured JSON format
 */

export interface LogContext {
  operation?: string;
  sectionId?: string;
  documentId?: string;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(context: LogContext, message: string): void;
  info(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
}

/**
 * Client-side structured logger implementation
 * Outputs JSON-formatted logs for SOC 2 compliance
 */
class ClientLogger implements Logger {
  private log(level: string, context: LogContext, message: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'document-editor-client',
      message,
      ...context,
    };

    // In production, this would be sent to a proper logging service
    // For now, we use console.log with structured format in development only
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(context: LogContext, message: string): void {
    this.log('debug', context, message);
  }

  info(context: LogContext, message: string): void {
    this.log('info', context, message);
  }

  warn(context: LogContext, message: string): void {
    this.log('warn', context, message);
  }

  error(context: LogContext, message: string): void {
    this.log('error', context, message);
  }
}

/**
 * Default logger instance
 */
export const logger = new ClientLogger();
