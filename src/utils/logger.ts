/**
 * Simple console logger with levels and colors
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const COLORS = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  RESET: '\x1b[0m',
};

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, levelName: string, ...args: unknown[]): void {
    if (level < this.level) return;
    const timestamp = new Date().toISOString();
    const color = COLORS[levelName as keyof typeof COLORS] || '';
    console.log(`${color}[${timestamp}] ${levelName}${COLORS.RESET}`, ...args);
  }

  debug(...args: unknown[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', ...args);
  }

  info(...args: unknown[]): void {
    this.log(LogLevel.INFO, 'INFO', ...args);
  }

  warn(...args: unknown[]): void {
    this.log(LogLevel.WARN, 'WARN', ...args);
  }

  error(...args: unknown[]): void {
    this.log(LogLevel.ERROR, 'ERROR', ...args);
  }
}

export const logger = new Logger();
