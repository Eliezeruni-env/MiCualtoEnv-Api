import { z } from 'zod';
import { TransportServiceType } from '../enums/index.js';

export const CreateTransportLogSchema = z.object({
  serviceType: z.nativeEnum(TransportServiceType),
  amount: z.string().or(z.number()).transform(v => String(v)),
  accountId: z.string().uuid('ID de cuenta requerida para el pago'),
  origin: z.string().optional(),
  destination: z.string().optional(),
  distanceKm: z.number().optional(),
  notes: z.string().optional(),
  tripDate: z.string().or(z.date()).optional().default(() => new Date().toISOString())
});

export type CreateTransportLogInput = z.infer<typeof CreateTransportLogSchema>;
