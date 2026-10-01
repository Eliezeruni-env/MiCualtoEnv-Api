import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  } | null;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
) {
  const payload: ApiResponse<T> = {
    data,
    error: null,
    meta
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  details?: unknown,
  code?: string
) {
  const payload: ApiResponse = {
    data: null,
    error: {
      message,
      code,
      details
    }
  };
  return res.status(statusCode).json(payload);
}
