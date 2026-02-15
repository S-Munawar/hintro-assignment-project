import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = statusCode === 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;

  logger.error(`${code}: ${err.message}`, {
    statusCode,
    stack: err.stack,
    details: err.details,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

/** Helper to create typed errors with status codes. */
export function createError(statusCode: number, code: string, message: string, details?: unknown): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}
