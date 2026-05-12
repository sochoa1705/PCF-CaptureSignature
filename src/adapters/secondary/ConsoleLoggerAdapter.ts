import { LoggerPort } from '../../ports/LoggerPort.js';

export type ConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error';

const order: Record<ConsoleLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Vanilla console logger with a level threshold and structured payloads.
 * Suitable for development; production deployments should swap it for an
 * Application Insights / Sentry adapter via the DI container.
 */
export class ConsoleLoggerAdapter implements LoggerPort {
  constructor(private readonly minLevel: ConsoleLogLevel = 'info') {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.write('error', message, { ...context, error: this.serialiseError(error) });
  }

  private write(level: ConsoleLogLevel, message: string, ctx?: Record<string, unknown>): void {
    if (order[level] < order[this.minLevel]) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      message,
      ...ctx,
    };
    const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    target.call(console, '[wacom-stu540]', line);
  }

  private serialiseError(err: unknown): unknown {
    if (!err) return undefined;
    if (err instanceof Error) {
      return { name: err.name, message: err.message, stack: err.stack };
    }
    return err;
  }
}
