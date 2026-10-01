import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { SystemService } from './system.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export class SystemController {
  static async resetAllData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { confirmation } = req.body;
      if (confirmation !== 'REINICIAR' && confirmation !== 'CONFIRMAR') {
        return sendError(
          res,
          'Se requiere la palabra de confirmación "REINICIAR" para proceder con el borrado total',
          400
        );
      }

      const result = await SystemService.resetAllUserData(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
