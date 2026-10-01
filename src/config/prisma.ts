import { PrismaClient } from '@prisma/client';

export type ExtendedPrisma = PrismaClient & {
  vaultDocument: any;
  vaultFolder: any;
  vaultFile: any;
  debt: any;
  debtPayment: any;
  loan: any;
  loanCollection: any;
  person: any;
  [key: string]: any;
};

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
}) as ExtendedPrisma;

