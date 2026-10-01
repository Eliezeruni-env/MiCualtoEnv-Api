import { prisma } from '../../config/prisma.js';

export class SystemService {
  /**
   * Reiniciar y limpiar completamente todos los datos financieros y registros del usuario.
   * Deja el sistema en 0 absoluto manteniendo la cuenta del usuario activa.
   */
  static async resetAllUserData(userId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Deudas y Abonos
      await tx.debtPayment.deleteMany({ where: { debt: { userId } } });
      await tx.debt.deleteMany({ where: { userId } });

      // 2. Préstamos, Cobros y Personas
      await tx.loanCollection.deleteMany({ where: { loan: { userId } } });
      await tx.loan.deleteMany({ where: { userId } });
      await tx.person.deleteMany({ where: { userId } });

      // 3. Transacciones y Movimientos
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.recurringTemplate.deleteMany({ where: { userId } });
      await tx.cardStatement.deleteMany({ where: { account: { userId } } });
      await tx.installmentPlan.deleteMany({ where: { userId } });
      await tx.statementImport.deleteMany({ where: { userId } });
      await tx.rawEvent.deleteMany({ where: { userId } });
      await tx.merchantRule.deleteMany({ where: { userId } });

      // 4. Suscripciones y Bóveda de Contraseñas
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.appCredential.deleteMany({ where: { userId } });

      // 5. Presupuestos y Metas
      await tx.goal.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });

      // 6. Quincenas y Nómina
      await tx.quincenaAllocation.deleteMany({ where: { quincenaPlan: { userId } } });
      await tx.quincenaPlan.deleteMany({ where: { userId } });

      // 7. Módulos Adicionales (Universidad, Inventario, Transporte, Ideas, Proyectos)
      await tx.universityExpense.deleteMany({ where: { userId } });
      await tx.personalInventoryItem.deleteMany({ where: { userId } });
      await tx.transportLog.deleteMany({ where: { userId } });
      await tx.idea.deleteMany({ where: { userId } });
      await tx.lifeMilestone.deleteMany({ where: { lifeProject: { userId } } });
      await tx.lifeProject.deleteMany({ where: { userId } });

      // 8. Bóveda de Documentos Segura
      await tx.vaultAccessLog.deleteMany({ where: { userId } });
      await tx.vaultTag.deleteMany({ where: { userId } });
      await tx.vaultDocument.deleteMany({ where: { userId } });
      await tx.vaultFolder.deleteMany({ where: { userId } });

      // 9. Alertas
      await tx.alert.deleteMany({ where: { userId } });

      // 10. Reset de Cuentas a Balance 0.00
      await tx.account.updateMany({
        where: { userId },
        data: {
          balance: 0.0,
        },
      });

      return {
        success: true,
        message: 'Sistema reiniciado con éxito. Todos los registros han sido puestos en 0.',
        resetTimestamp: new Date().toISOString(),
      };
    });
  }
}
