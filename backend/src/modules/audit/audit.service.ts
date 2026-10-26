import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Paginated } from '../../common/types/paginated.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { QueryAuditDto } from './dto/query-audit.dto.js';

type Db = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  /** Código del evento, p. ej. "folio.discount". */
  action: string;
  /** Tipo de registro afectado, p. ej. "reservation". */
  entity: string;
  entityId?: string | null;
  /** Texto legible en español. */
  summary: string;
  data?: Prisma.InputJsonValue;
  authorizedById?: string | null;
}

/** Bitácora: quién hizo qué, cuándo y quién lo autorizó. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra un evento; dentro de una transacción si se pasa `db`. */
  async log(actor: AuthUser, entry: AuditEntry, db: Db = this.prisma) {
    await db.auditLog.create({
      data: {
        hotelId: actor.hotelId,
        actorId: actor.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        data: entry.data,
        authorizedById: entry.authorizedById ?? null,
      },
    });
  }

  async list(
    actor: AuthUser,
    query: QueryAuditDto,
  ): Promise<Paginated<unknown>> {
    const where: Prisma.AuditLogWhereInput = {
      hotelId: actor.hotelId,
      ...(query.entity && { entity: query.entity }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.search && {
        summary: { contains: query.search, mode: 'insensitive' },
      }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lt: new Date(query.to) }),
        },
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true } },
          authorizedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }
}

/** Campos que cambian: compara el registro actual con lo que se envía. */
export function changedFields(
  before: object,
  input: object,
): Record<string, { from: unknown; to: unknown }> {
  const result: Record<string, { from: unknown; to: unknown }> = {};
  const old = before as Record<string, unknown>;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const raw = old[key];
    const from = raw instanceof Date ? raw.toISOString().slice(0, 10) : raw;
    if (JSON.stringify(from ?? null) !== JSON.stringify(value)) {
      result[key] = { from: from ?? null, to: value };
    }
  }
  return result;
}
