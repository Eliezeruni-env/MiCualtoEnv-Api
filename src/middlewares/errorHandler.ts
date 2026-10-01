import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.details);
  }

  // Errores de validación de Zod
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(', ');
    return sendError(res, message || 'Error de validación en los datos enviados', 400, err.errors);
  }

  // Errores de Prisma conocidos
  if (err.name === 'PrismaClientKnownRequestError') {
    return sendError(res, 'Error en operación de base de datos', 400, err);
  }

  // Error de sintaxis JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 'El formato JSON de la solicitud es inválido', 400);
  }

  console.error('[Unhandled Error]', err);
  return sendError(res, 'Ocurrió un error inesperado en el servidor', 500);
}
