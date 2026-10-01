import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

export interface CreateCategoryDTO {
  name: string;
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT' | string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  isTransport?: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT' | string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

export class CategoriesService {
  /**
   * Lista todas las categorías disponibles para el usuario (del sistema + personalizadas del usuario)
   * Permite filtrar opcionalmente por tipo (EXPENSE, INCOME, TRANSFER, INVESTMENT)
   */
  static async list(userId: string, type?: string) {
    // 1. Asegurar que las categorías base estén pobladas sin borrar nada
    await this.ensureDefaults(userId);

    const whereClause: any = {
      OR: [{ userId }, { isSystem: true }],
    };

    if (type && type !== 'ALL') {
      whereClause.type = type.toUpperCase();
    }

    return prisma.category.findMany({
      where: whereClause,
      include: {
        parent: true,
        _count: {
          select: {
            transactions: true,
            budgetLines: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Obtiene una categoría por su ID
   */
  static async getById(userId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId }, { isSystem: true }],
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!category) {
      throw AppError.notFound('Categoría no encontrada');
    }

    return category;
  }

  /**
   * Crea una nueva categoría asignada al tipo correspondiente
   */
  static async create(userId: string, input: CreateCategoryDTO) {
    if (!input.name || !input.name.trim()) {
      throw AppError.badRequest('El nombre de la categoría es requerido');
    }

    const name = input.name.trim();
    const type = (input.type || 'EXPENSE').toUpperCase();
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // Garantizar slug único por usuario
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.category.findFirst({ where: { userId, slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const defaultColors: Record<string, string> = {
      EXPENSE: '#e11d48',
      INCOME: '#16a34a',
      TRANSFER: '#0284c7',
      INVESTMENT: '#8b5cf6',
    };

    const defaultIcons: Record<string, string> = {
      EXPENSE: 'tag',
      INCOME: 'briefcase',
      TRANSFER: 'repeat',
      INVESTMENT: 'trending-up',
    };

    return prisma.category.create({
      data: {
        userId,
        name,
        slug,
        type,
        color: input.color || defaultColors[type] || '#0284c7',
        icon: input.icon || defaultIcons[type] || 'tag',
        parentId: input.parentId || undefined,
        isTransport: Boolean(input.isTransport),
        isSystem: false,
      },
      include: {
        parent: true,
      },
    });
  }

  /**
   * Actualiza una categoría personalizada existente
   */
  static async update(userId: string, id: string, input: UpdateCategoryDTO) {
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw AppError.notFound('Categoría no encontrada o es del sistema y no puede modificarse');
    }

    const dataToUpdate: any = {};
    if (input.name && input.name.trim()) {
      dataToUpdate.name = input.name.trim();
    }
    if (input.type) {
      dataToUpdate.type = input.type.toUpperCase();
    }
    if (input.color) {
      dataToUpdate.color = input.color;
    }
    if (input.icon) {
      dataToUpdate.icon = input.icon;
    }
    if (input.parentId !== undefined) {
      dataToUpdate.parentId = input.parentId || null;
    }

    return prisma.category.update({
      where: { id },
      data: dataToUpdate,
      include: {
        parent: true,
      },
    });
  }

  /**
   * Elimina una categoría si no tiene movimientos enlazados
   */
  static async delete(userId: string, id: string) {
    const existing = await prisma.category.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound('Categoría no encontrada o no tienes permisos para eliminarla');
    }

    if (existing._count.transactions > 0) {
      throw AppError.badRequest(
        `Esta categoría tiene ${existing._count.transactions} movimiento(s) contable(s) enlazados. No puede eliminarse para preservar la integridad del ledger.`
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return { success: true, message: 'Categoría eliminada con éxito' };
  }

  /**
   * Seeding de categorías base sin tocar ni borrar NINGUNA categoría existente
   */
  static async ensureDefaults(userId: string) {
    const standardCategories = [
      // GASTOS (EXPENSE)
      { name: 'Alimentación y Supermercado', slug: 'supermercado-comida', icon: 'shopping-cart', color: '#ea580c', type: 'EXPENSE', isTransport: false },
      { name: 'Transporte & Movilidad RD', slug: 'transporte-movilidad', icon: 'car', color: '#0284c7', type: 'EXPENSE', isTransport: true },
      { name: 'Vivienda & Servicios', slug: 'vivienda-servicios', icon: 'home', color: '#7c3aed', type: 'EXPENSE', isTransport: false },
      { name: 'Salud, Médicos & Farmacia', slug: 'salud-farmacia', icon: 'heart', color: '#e11d48', type: 'EXPENSE', isTransport: false },
      { name: 'Suscripciones & Streaming', slug: 'suscripciones', icon: 'tv', color: '#f43f5e', type: 'EXPENSE', isTransport: false },
      { name: 'Restaurantes & Ocio', slug: 'restaurantes-ocio', icon: 'utensils', color: '#f59e0b', type: 'EXPENSE', isTransport: false },
      { name: 'Educación & Cursos', slug: 'educacion-cursos', icon: 'book-open', color: '#3b82f6', type: 'EXPENSE', isTransport: false },
      { name: 'Compras & Tecnología', slug: 'compras-tecnologia', icon: 'smartphone', color: '#06b6d4', type: 'EXPENSE', isTransport: false },
      { name: 'Otros Gastos Personales', slug: 'otros-gastos', icon: 'tag', color: '#64748b', type: 'EXPENSE', isTransport: false },

      // INGRESOS (INCOME)
      { name: 'Salario & Nómina Quincenal', slug: 'salario', icon: 'briefcase', color: '#16a34a', type: 'INCOME', isTransport: false },
      { name: 'Honorarios & Freelance', slug: 'honorarios-freelance', icon: 'laptop', color: '#10b981', type: 'INCOME', isTransport: false },
      { name: 'Rendimientos & Inversiones', slug: 'rendimientos-inversiones', icon: 'trending-up', color: '#8b5cf6', type: 'INCOME', isTransport: false },
      { name: 'Ventas & Negocios', slug: 'ventas-negocios', icon: 'store', color: '#059669', type: 'INCOME', isTransport: false },
      { name: 'Otros Ingresos', slug: 'otros-ingresos', icon: 'plus-circle', color: '#22c55e', type: 'INCOME', isTransport: false },

      // TRASPASOS & MOVIMIENTOS INTERNOS (TRANSFER)
      { name: 'Traspaso Entre Cuentas', slug: 'traspaso-cuentas', icon: 'repeat', color: '#0ea5e9', type: 'TRANSFER', isTransport: false },
      { name: 'Pago de Tarjeta de Crédito', slug: 'pago-tarjeta', icon: 'credit-card', color: '#2563eb', type: 'TRANSFER', isTransport: false },

      // INVERSIONES & CAPITAL (INVESTMENT)
      { name: 'Fondo de Emergencia & Metas', slug: 'fondo-emergencia', icon: 'shield', color: '#6366f1', type: 'INVESTMENT', isTransport: false },
      { name: 'Puesto de Bolsa / Certificados', slug: 'bolsa-certificados', icon: 'building', color: '#4f46e5', type: 'INVESTMENT', isTransport: false },
    ];

    for (const cat of standardCategories) {
      const exists = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: cat.slug },
            { name: cat.name },
          ],
        },
      });

      if (!exists) {
        await prisma.category.create({
          data: {
            userId,
            name: cat.name,
            slug: cat.slug,
            type: cat.type,
            icon: cat.icon,
            color: cat.color,
            isTransport: cat.isTransport,
            isSystem: false,
          },
        });
      }
    }
  }
}
