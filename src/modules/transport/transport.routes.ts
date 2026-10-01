import { Router } from 'express';
import { TransportController } from './transport.controller.js';
import { MetroCardsController } from './metro-cards.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { CreateTransportLogSchema } from '@micualto/shared';

const router = Router();

router.use(requireAuth);

// Rutas de viajes de transporte
router.get('/', TransportController.list);
router.get('/stats', TransportController.stats);
router.post('/', validateBody(CreateTransportLogSchema), TransportController.create);
router.delete('/all', TransportController.deleteAll);
router.delete('/:id', TransportController.delete);

// Rutas especializadas de Tarjetas del Metro de Santo Domingo
router.get('/metro-cards', MetroCardsController.list);
router.post('/metro-cards', MetroCardsController.create);
router.put('/metro-cards/:id', MetroCardsController.update);
router.delete('/metro-cards/:id', MetroCardsController.delete);
router.post('/metro-cards/:id/recharge', MetroCardsController.recharge);
router.post('/metro-cards/trip', MetroCardsController.registerTrip);
router.post('/metro-cards/:id/trip', MetroCardsController.registerTrip);
router.get('/metro-cards/:id/recharges', MetroCardsController.listRecharges);

export default router;
