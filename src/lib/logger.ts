/**
 * Logging utilities using Winston
 */

import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || './logs/mcp-server.log';

/**
 * Create a Winston logger instance
 */
export function createLogger(module: string): winston.Logger {
  const formats: winston.Logform.Format[] = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  ];

  // Add module label
  formats.push(winston.format.label({ label: module }));

  // Choose format based on configuration
  if (LOG_FORMAT === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.printf(({ timestamp, level, label, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}] [${label}] ${message} ${metaStr}`;
      })
    );
  }

  const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(...formats),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, label, message }) => {
            return `${timestamp} [${level}] [${label}] ${message}`;
          })
        ),
      }),
    ],
  });

  // Add file transport if path is specified
  if (LOG_FILE_PATH) {
    logger.add(
      new winston.transports.File({
        filename: LOG_FILE_PATH,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  return logger;
}

// Export a default logger instance
export const logger = createLogger('app');
