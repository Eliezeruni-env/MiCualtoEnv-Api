import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando toda la base de datos de MiCualtoEnv...');

  // Eliminar en orden estricto de claves foráneas
  await prisma.vaultAccessLog.deleteMany();
  await prisma.vaultDocumentTag.deleteMany();
  await prisma.vaultTag.deleteMany();
  await prisma.vaultFile.deleteMany();
  await prisma.vaultDocument.deleteMany();
  await prisma.vaultFolder.deleteMany();

  await prisma.ideaLesson.deleteMany();
  await prisma.ideaStageHistory.deleteMany();
  await prisma.ideaFinancialModel.deleteMany();
  await prisma.ideaDecision.deleteMany();
  await prisma.ideaCompetitor.deleteMany();
  await prisma.ideaSwot.deleteMany();
  await prisma.ideaCanvas.deleteMany();
  await prisma.ideaNote.deleteMany();
  await prisma.ideaTask.deleteMany();
  await prisma.ideaPartner.deleteMany();
  await prisma.idea.deleteMany();

  await prisma.lifeMilestone.deleteMany();
  await prisma.lifeProject.deleteMany();

  await prisma.transportLog.deleteMany();
  await prisma.debtPayment.deleteMany();
  await prisma.loanCollection.deleteMany();
  await prisma.recurringOccurrence.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.recurringTemplate.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.installmentPlan.deleteMany();
  await prisma.cardStatement.deleteMany();
  await prisma.statementImport.deleteMany();
  await prisma.merchantRule.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.rawEvent.deleteMany();

  await prisma.account.deleteMany();
  await prisma.bank.deleteMany();
  await prisma.category.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.person.deleteMany();
  await prisma.project.deleteMany();
  await prisma.exchangeRate.deleteMany();

  await prisma.secureSession.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('✨ Base de datos completamente limpia y vacía, lista para producción personal!');
}

main()
  .catch((err) => {
    console.error('Error al limpiar base de datos:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
