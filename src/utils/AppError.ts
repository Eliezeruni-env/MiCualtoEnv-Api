export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(msg: string, details?: unknown) {
    return new AppError(msg, 400, details);
  }

  static unauthorized(msg = 'No autorizado') {
    return new AppError(msg, 401);
  }

  static forbidden(msg = 'Acceso denegado') {
    return new AppError(msg, 403);
  }

  static notFound(msg = 'Recurso no encontrado') {
    return new AppError(msg, 404);
  }

  static internal(msg = 'Error interno del servidor') {
    return new AppError(msg, 500);
  }
}
