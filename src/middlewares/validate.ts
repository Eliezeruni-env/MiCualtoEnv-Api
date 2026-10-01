import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(AppError.badRequest('Error de validación en la solicitud', issues));
      }
      return next(err);
    }
  };
}
