/**
 * Logger module for structured logging
 * Provides consistent logging across the application
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Determine if we're running as the main application or as a dependency
const isMainApplication = process.env.MCP_COMPASS_MAIN === 'true';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Create a custom format for console output (with colors)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: false }),
  winston.format.printf(info => {
    // Add context information if available
    const context = info.context ? ` [${info.context}]` : '';
    return `${info.timestamp} ${info.level}${context}: ${info.message}`;
  }),
);

/**
 * 格式化错误对象，提取堆栈信息
 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    // 如果是标准 Error 对象，返回消息和堆栈
    return `${error.message}\nStack: ${error.stack || 'No stack trace available'}`;
  } else if (typeof error === 'object' && error !== null) {
    // 如果是其他对象，尝试 JSON 序列化
    try {
      return JSON.stringify(error, null, 2);
    } catch (e) {
      return String(error);
    }
  } else {
    // 其他情况直接转为字符串
    return String(error);
  }
};

// Create a custom format for file output (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.uncolorize(),
  winston.format.printf(info => {
    // Add context information if available
    const context = info.context ? ` [${info.context}]` : '';

    // 处理错误对象和堆栈信息
    let message = info.message;
    if (info.level === 'error' && info.error) {
      message = `${message}\n${formatError(info.error)}`;
    }

    // Add structured data if available
    let structuredData = '';
    if (info.data) {
      try {
        structuredData = ` | ${typeof info.data === 'string' ? info.data : JSON.stringify(info.data)}`;
      } catch (e) {
        structuredData = ' | [Unserializable data]';
      }
    }

    return `${info.timestamp} ${info.level}${context}: ${message}${structuredData}`;
  }),
);

// Define transports based on mode
const transports = [];

// Only add file logging if explicitly enabled or running as main application
if (isMainApplication || process.env.ENABLE_FILE_LOGGING === 'true') {
  try {
    // Use environment variable if provided, otherwise use default
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

    // Only try to create directory if we're the main application
    if (isMainApplication && !fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Only add file transports if directory exists
    if (fs.existsSync(logsDir)) {
      transports.push(
        // File transport for errors
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          format: fileFormat,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logsDir, 'all.log'),
          format: fileFormat,
        }),
      );
    }
  } catch (error) {
    // Silently fail - no console output
  }
}

// Add a console transport (silent by default unless explicitly enabled)
const isConsoleEnabled = process.env.ENABLE_CONSOLE_LOGGING === 'true';
transports.push(
  new winston.transports.Console({
    // stdout belongs to the MCP stdio transport, even when diagnostics are enabled.
    stderrLevels: Object.keys(levels),
    format: consoleFormat,
    silent: !isConsoleEnabled && !isMainApplication,
    handleExceptions: false,
  }),
);

// Create the logger with silent mode when used as a dependency
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  defaultMeta: { service: 'mcpadvisor' },
  transports,
  silent:
    !isMainApplication &&
    !isConsoleEnabled &&
    process.env.ENABLE_FILE_LOGGING !== 'true', // Silent unless a logging destination is enabled
  exitOnError: false, // Don't crash on logging errors
});

// Add helper methods for structured logging
interface LogMethod {
  (message: string): void;
  (message: string, data: any): void;
  (message: string, context: string, data?: any): void;
}

// Extend the base logger with enhanced methods
const enhancedLogger = {
  ...logger,
  error: createLogMethod('error'),
  warn: createLogMethod('warn'),
  info: createLogMethod('info'),
  http: createLogMethod('http'),
  debug: createLogMethod('debug'),
};

// Helper function to create enhanced log methods
function createLogMethod(level: string): LogMethod {
  return function (message: string, contextOrData?: any, data?: any): void {
    // Check if second argument is context or data
    if (typeof contextOrData === 'string') {
      // If third argument exists, it's data
      logger.log(level, message, { context: contextOrData, data });
    } else if (contextOrData !== undefined) {
      // If second argument exists but isn't a string, it's data
      logger.log(level, message, { data: contextOrData });
    } else {
      // Just the message
      logger.log(level, message);
    }
  };
}

// Suppress logger errors by adding a no-op error handler
logger.on('error', () => {});

export default enhancedLogger;
