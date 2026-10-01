import {
  PrismaClient,
  AccountType,
  Currency,
  TransactionType,
  TransactionSource,
  TransportServiceType,
  GoalKind,
  GoalMode,
} from "@prisma/client";
// import argon2 from "argon2";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log(
    "🌱 Iniciando Seed de datos demo para MiCualtoEnv (República Dominicana)...",
  );

  // 1. Limpiar datos existentes en orden
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
  await prisma.account.deleteMany();
  await prisma.bank.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // 2. Crear usuario principal
  const passwordHash = await "admin123";
  const user = await prisma.user.create({
    data: {
      email: "pelier@fintrack.do",
      username: "pelier",
      passwordHash,
      name: "Pelier",
      baseCurrency: Currency.DOP,
    },
  });
  console.log(`👤 Usuario creado: ${user.email}`);

  // 3. Crear Bancos Dominicanos
  const banks = await Promise.all([
    prisma.bank.create({
      data: {
        name: "Qik Banco Digital",
        slug: "qik",
        color: "#10b981",
        isDefault: true,
      },
    }),
    prisma.bank.create({
      data: {
        name: "Banreservas",
        slug: "banreservas",
        color: "#15803d",
        isDefault: true,
      },
    }),
    prisma.bank.create({
      data: {
        name: "Mío Billetera",
        slug: "mio",
        color: "#f97316",
        isDefault: true,
      },
    }),
    prisma.bank.create({
      data: {
        name: "Asociación La Nacional",
        slug: "alnap",
        color: "#2563eb",
        isDefault: true,
      },
    }),
    prisma.bank.create({
      data: {
        name: "Banco Popular Dominicano",
        slug: "popular",
        color: "#047857",
        isDefault: false,
      },
    }),
    prisma.bank.create({
      data: {
        name: "Banco BHD",
        slug: "bhd",
        color: "#dc2626",
        isDefault: false,
      },
    }),
  ]);
  const [qik, banreservas, mio, alnap] = banks;
  console.log(`🏦 ${banks.length} bancos dominicanos creados`);

  // 4. Crear Cuentas Bancarias
  const [accQik, accBanreservas, cardVisa, accMio, accCash] = await Promise.all(
    [
      prisma.account.create({
        data: {
          userId: user.id,
          bankId: qik.id,
          name: "Ahorro Digital Qik",
          type: AccountType.SAVINGS,
          currency: Currency.DOP,
          balance: 145250.0,
          last4: "8841",
          color: "#10b981",
        },
      }),
      prisma.account.create({
        data: {
          userId: user.id,
          bankId: banreservas.id,
          name: "Cuenta Nómina Banreservas",
          type: AccountType.CHECKING,
          currency: Currency.DOP,
          balance: 58400.0,
          last4: "1092",
          color: "#15803d",
        },
      }),
      prisma.account.create({
        data: {
          userId: user.id,
          bankId: banreservas.id,
          name: "Visa Infinite Banreservas",
          type: AccountType.CREDIT_CARD,
          currency: Currency.DOP,
          balance: 18350.0, // Deuda actual
          creditLimit: 120000.0,
          statementDay: 15,
          dueDay: 5,
          last4: "4599",
          color: "#dc2626",
        },
      }),
      prisma.account.create({
        data: {
          userId: user.id,
          bankId: mio.id,
          name: "Billetera Mío",
          type: AccountType.DIGITAL_WALLET,
          currency: Currency.DOP,
          balance: 4200.0,
          last4: "3310",
          color: "#f97316",
        },
      }),
      prisma.account.create({
        data: {
          userId: user.id,
          name: "Efectivo en Mano",
          type: AccountType.CASH,
          currency: Currency.DOP,
          balance: 6500.0,
          color: "#64748b",
        },
      }),
    ],
  );
  console.log("💳 Cuentas y tarjetas bancarias creadas");

  // 5. Crear Categorías
  const catTransport = await prisma.category.create({
    data: {
      userId: user.id,
      name: "Transporte & Movilidad",
      slug: "transporte-movilidad",
      icon: "car",
      color: "#0284c7",
      isTransport: true,
      isSystem: true,
    },
  });

  const catFood = await prisma.category.create({
    data: {
      userId: user.id,
      name: "Supermercado & Comida",
      slug: "supermercado-comida",
      icon: "shopping-cart",
      color: "#ea580c",
    },
  });

  const catHousing = await prisma.category.create({
    data: {
      userId: user.id,
      name: "Vivienda & Servicios",
      slug: "vivienda-servicios",
      icon: "home",
      color: "#7c3aed",
    },
  });

  const catSubscriptions = await prisma.category.create({
    data: {
      userId: user.id,
      name: "Suscripciones Digitales",
      slug: "suscripciones",
      icon: "tv",
      color: "#e11d48",
    },
  });

  const catSalary = await prisma.category.create({
    data: {
      userId: user.id,
      name: "Salario & Nómina",
      slug: "salario",
      icon: "briefcase",
      color: "#16a34a",
    },
  });

  // 6. Crear Metas de Ahorro y Compra
  await Promise.all([
    prisma.goal.create({
      data: {
        userId: user.id,
        name: "Fondo de Emergencia (6 Meses)",
        kind: GoalKind.SAVINGS,
        mode: GoalMode.VIRTUAL_ENVELOPE,
        targetAmount: 250000.0,
        currentAmount: 40000.0,
        currency: Currency.DOP,
        icon: "shield",
        color: "#10b981",
      },
    }),
    prisma.goal.create({
      data: {
        userId: user.id,
        name: "Laptop Apple MacBook M-series",
        kind: GoalKind.PURCHASE,
        mode: GoalMode.VIRTUAL_ENVELOPE,
        targetAmount: 85000.0,
        currentAmount: 25000.0,
        currency: Currency.DOP,
        icon: "laptop",
        color: "#3b82f6",
      },
    }),
  ]);
  console.log("🎯 Metas creadas");

  // 7. Crear Transacciones y Viajes en Transporte
  // Gasto 1: Uber desde Casa a Piantini
  const txUber1 = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 345.0,
      currency: Currency.DOP,
      accountId: cardVisa.id,
      categoryId: catTransport.id,
      notes: "Viaje en Uber: Casa -> Piantini",
      occurredAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  });
  await prisma.transportLog.create({
    data: {
      userId: user.id,
      transactionId: txUber1.id,
      serviceType: TransportServiceType.UBER,
      origin: "Residencial",
      destination: "Oficina Piantini",
      distanceKm: 8.5,
      tripDate: txUber1.occurredAt,
    },
  });

  // Gasto 2: DiDi regreso
  const txDidi = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 280.0,
      currency: Currency.DOP,
      accountId: cardVisa.id,
      categoryId: catTransport.id,
      notes: "Viaje en DiDi: Piantini -> Casa",
      occurredAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
    },
  });
  await prisma.transportLog.create({
    data: {
      userId: user.id,
      transactionId: txDidi.id,
      serviceType: TransportServiceType.DIDI,
      origin: "Piantini",
      destination: "Residencial",
      distanceKm: 8.5,
      tripDate: txDidi.occurredAt,
    },
  });

  // Gasto 3: Recarga Metro de Santo Domingo
  const txMetro = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 200.0,
      currency: Currency.DOP,
      accountId: accMio.id,
      categoryId: catTransport.id,
      notes: "Recarga tarjeta Metro Santo Domingo (10 viajes)",
      occurredAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
  });
  await prisma.transportLog.create({
    data: {
      userId: user.id,
      transactionId: txMetro.id,
      serviceType: TransportServiceType.METRO_SANTO_DOMINGO,
      origin: "Estación Juan Pablo Duarte",
      destination: "Centro de los Héroes",
      tripDate: txMetro.occurredAt,
    },
  });

  // Gasto 4: Combustible Estación TotalEnergies
  const txFuel = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 2500.0,
      currency: Currency.DOP,
      accountId: cardVisa.id,
      categoryId: catTransport.id,
      notes: "Combustible TotalEnergies Av. 27 de Febrero",
      occurredAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    },
  });
  await prisma.transportLog.create({
    data: {
      userId: user.id,
      transactionId: txFuel.id,
      serviceType: TransportServiceType.FUEL,
      notes: "Tanque lleno",
      tripDate: txFuel.occurredAt,
    },
  });

  // Gasto 5: Supermercado Bravo
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 4850.0,
      currency: Currency.DOP,
      accountId: accBanreservas.id,
      categoryId: catFood.id,
      notes: "Supermercado Bravo Churchill",
      occurredAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
  });

  // Gasto 6: Internet Claro Fibra
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: 2195.0,
      currency: Currency.DOP,
      accountId: accBanreservas.id,
      categoryId: catHousing.id,
      notes: "Factura Claro Internet 100 Mbps",
      occurredAt: new Date(Date.now() - 6 * 24 * 3600 * 1000),
    },
  });

  // Ingreso: Salario Quincenal
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.INCOME,
      amount: 65000.0,
      currency: Currency.DOP,
      accountId: accBanreservas.id,
      categoryId: catSalary.id,
      notes: "Pago Nómina 15 de Septiembre",
      occurredAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    },
  });

  // 8. Crear Carpetas en Bóveda (Vault)
  const folderLegal = await prisma.vaultFolder.create({
    data: {
      userId: user.id,
      name: "Documentos Legales & Personales",
      color: "#1e40af",
      icon: "shield",
    },
  });

  const folderVehicles = await prisma.vaultFolder.create({
    data: {
      userId: user.id,
      name: "Vehículos & Seguros",
      color: "#0284c7",
      icon: "car",
    },
  });

  // Documento demo de Bóveda: Cédula de Identidad
  await prisma.vaultDocument.create({
    data: {
      userId: user.id,
      folderId: folderLegal.id,
      title: "Cédula de Identidad y Electoral",
      category: "IDENTITY",
      subType: "Cédula JCE",
      issuer: "Junta Central Electoral (JCE)",
      documentNumber: "402-XXXXXXX-X",
      expiryDate: new Date("2030-05-16"),
      status: "ACTIVE",
      notes: "Documento oficial de identidad personal",
      isFavorite: true,
    },
  });

  // Documento demo de Bóveda: Marbete Vehículo
  await prisma.vaultDocument.create({
    data: {
      userId: user.id,
      folderId: folderVehicles.id,
      title: "Marbete e Impuesto de Circulación 2026",
      category: "PROPERTY_VEHICLES",
      subType: "Marbete DGII",
      issuer: "DGII",
      expiryDate: new Date("2026-12-31"),
      status: "ACTIVE",
      notes: "Renovado en línea",
    },
  });

  // 9. Crear Ideas Demo en IdeaLab
  const ideaFintech = await prisma.idea.create({
    data: {
      userId: user.id,
      title: "Plataforma de Microcréditos para PyMEs Dominicanas",
      oneLinePitch:
        "Evaluación crediticia algorítmica para colmados y talleres usando historial de compras",
      type: "PERSONAL",
      stage: "VALIDATING",
      category: "Fintech & Inclusión",
      priority: 1,
      impactScore: 9,
      confidenceScore: 7,
      easeScore: 6,
      iceScore: 7.33,
    },
  });

  await prisma.ideaCanvas.create({
    data: {
      ideaId: ideaFintech.id,
      problem:
        "Los bancos tradicionales tardan semanas en aprobar líneas de capital de trabajo a comercios informales.",
      solution:
        "Scoring alternativo en 5 minutos con desembolso a billetera digital.",
      valueProposition:
        "Capital inmediato sin papeleos extenuantes con cobro diario o semanal.",
      customerSegments:
        "Colmados, minimarkets y negocios de barrio en Santo Domingo y Santiago.",
      channels: "Distribuidores mayoristas y aplicación móvil.",
      revenueStreams:
        "Comisión por originación y tasa de interés preferencial.",
      costStructure: "Infraestructura cloud, scoring API y costo de capital.",
      keyMetrics: "Tasa de morosidad < 3%, tiempo de aprobación < 10 mins.",
      unfairAdvantage: "Alianzas con suplidores de consumo masivo.",
    },
  });

  // 10. Crear Proyecto de Vida Demo
  const lifeProj = await prisma.lifeProject.create({
    data: {
      userId: user.id,
      title: "Adquisición de Apartamento Propio en Distrito Nacional",
      area: "FINANCIAL_FREEDOM",
      vision:
        "Tener una vivienda familiar libre de deudas en una zona céntrica con alta plusvalía.",
      targetYear: 2028,
      status: "IN_PROGRESS",
      progressPct: 35,
    },
  });

  await prisma.lifeMilestone.createMany({
    data: [
      {
        lifeProjectId: lifeProj.id,
        title: "Completar Fondo de Inicial (20% del valor)",
        targetDate: new Date("2027-06-30"),
        isCompleted: false,
      },
      {
        lifeProjectId: lifeProj.id,
        title:
          "Evaluación y Calificación de Préstamo Hipotecario en Banreservas",
        targetDate: new Date("2027-10-15"),
        isCompleted: false,
      },
      {
        lifeProjectId: lifeProj.id,
        title: "Firma de Contrato de Promesa de Compraventa",
        targetDate: new Date("2028-01-30"),
        isCompleted: false,
      },
    ],
  });

  console.log(
    "✅ Base de datos poblada exitosamente con datos dominicanos, Bóveda, Ideas y Proyectos de Vida!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
