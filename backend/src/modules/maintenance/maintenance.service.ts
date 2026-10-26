import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type {
  CreateTicketDto,
  QueryTicketsDto,
  ResolveTicketDto,
} from './dto/maintenance.dto.js';

const person = { select: { id: true, name: true } } as const;
const OPEN = ['OPEN', 'IN_PROGRESS'] as const;
// Cerrados que se muestran en la lista (los demás, en el reporte).
const CLOSED_DAYS = 30;

const ticketInclude = {
  room: { select: { id: true, number: true, floor: true, status: true } },
  reportedBy: person,
  resolvedBy: person,
} satisfies Prisma.MaintenanceTicketInclude;

/**
 * Tickets de mantenimiento. Cualquiera reporta; ADMIN y recepción los
 * atienden y registran quién lo arregló.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly audit: AuditService,
  ) {}

  list(actor: AuthUser, query: QueryTicketsDto) {
    const closed = query.status === 'closed';
    return this.prisma.maintenanceTicket.findMany({
      where: {
        hotelId: actor.hotelId,
        ...(query.roomId && { roomId: query.roomId }),
        ...(closed
          ? {
              status: { in: ['RESOLVED', 'CANCELLED'] },
              createdAt: {
                gte: new Date(Date.now() - CLOSED_DAYS * 86_400_000),
              },
            }
          : { status: { in: [...OPEN] } }),
      },
      include: ticketInclude,
      orderBy: closed
        ? [{ resolvedAt: 'desc' }, { createdAt: 'desc' }]
        : [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(actor: AuthUser, dto: CreateTicketDto) {
    if (!dto.roomId && !dto.area) {
      throw new BadRequestException('Elige la habitación o escribe el área');
    }
    const room = dto.roomId
      ? await this.prisma.room.findFirst({
          where: { id: dto.roomId, hotelId: actor.hotelId, isActive: true },
        })
      : null;
    if (dto.roomId && !room) {
      throw new NotFoundException('Habitación no encontrada');
    }

    let blocksRoom = false;
    if (dto.blocksRoom) {
      if (actor.role === 'HOUSEKEEPING') {
        throw new ForbiddenException(
          'Solo recepción o un administrador pueden bloquear la habitación',
        );
      }
      if (!room) {
        throw new BadRequestException(
          'Solo se puede bloquear una habitación, no un área',
        );
      }
      if (room.status === 'OCCUPIED') {
        throw new BadRequestException(
          `La habitación ${room.number} tiene huésped; regístralo sin bloquear o cámbialo de habitación`,
        );
      }
      blocksRoom = true;
      // Si ya está bloqueada, solo se liga el ticket.
      if (room.status !== 'MAINTENANCE' && room.status !== 'OUT_OF_SERVICE') {
        if (!dto.blockedUntil) {
          throw new BadRequestException(
            'Indica hasta qué fecha estará en Mantenimiento',
          );
        }
        await this.rooms.changeStatus(actor, room.id, {
          status: 'MAINTENANCE',
          reason: dto.description.slice(0, 300),
          blockedUntil: dto.blockedUntil,
        });
      }
    }

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        hotelId: actor.hotelId,
        roomId: room?.id ?? null,
        area: room ? null : dto.area,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        blocksRoom,
        reportedById: actor.id,
      },
      include: ticketInclude,
    });
    await this.audit.log(actor, {
      action: 'ticket.create',
      entity: 'maintenance_ticket',
      entityId: ticket.id,
      summary: `Reportó en ${place(ticket)}: ${ticket.description}${blocksRoom ? ' (bloquea la habitación)' : ''}`,
    });
    return ticket;
  }

  async start(actor: AuthUser, id: string) {
    const ticket = await this.findOpen(actor, id);
    if (ticket.status === 'IN_PROGRESS') {
      throw new BadRequestException('El ticket ya está en proceso');
    }
    return this.prisma.maintenanceTicket.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: ticketInclude,
    });
  }

  /**
   * Resuelve el ticket. Si bloqueaba la habitación y no quedan otros
   * tickets que la bloqueen, la manda a Limpieza.
   */
  async resolve(actor: AuthUser, id: string, dto: ResolveTicketDto) {
    const ticket = await this.findOpen(actor, id);
    const resolved = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: actor.id,
        fixedBy: dto.fixedBy,
        resolution: dto.resolution,
      },
      include: ticketInclude,
    });
    await this.audit.log(actor, {
      action: 'ticket.resolve',
      entity: 'maintenance_ticket',
      entityId: id,
      summary: `Resolvió en ${place(ticket)} (${dto.fixedBy}): ${dto.resolution}`,
    });
    const released = await this.releaseRoom(actor, ticket);
    return { ...resolved, roomReleased: released };
  }

  async cancel(actor: AuthUser, id: string, reason: string) {
    const ticket = await this.findOpen(actor, id);
    const cancelled = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        resolvedAt: new Date(),
        resolvedById: actor.id,
        cancelReason: reason,
      },
      include: ticketInclude,
    });
    await this.audit.log(actor, {
      action: 'ticket.cancel',
      entity: 'maintenance_ticket',
      entityId: id,
      summary: `Canceló el ticket de ${place(ticket)}: ${reason}`,
    });
    const released = await this.releaseRoom(actor, ticket);
    return { ...cancelled, roomReleased: released };
  }

  // -------------------------------------------------------------------------

  private async releaseRoom(
    actor: AuthUser,
    ticket: { id: string; roomId: string | null; blocksRoom: boolean },
  ): Promise<boolean> {
    if (!ticket.blocksRoom || !ticket.roomId) return false;
    const others = await this.prisma.maintenanceTicket.count({
      where: {
        roomId: ticket.roomId,
        blocksRoom: true,
        status: { in: [...OPEN] },
        id: { not: ticket.id },
      },
    });
    if (others > 0) return false;
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: ticket.roomId },
    });
    if (room.status !== 'MAINTENANCE') return false;
    await this.rooms.changeStatus(actor, room.id, {
      status: 'CLEANING',
      reason: 'Mantenimiento resuelto',
    });
    return true;
  }

  private async findOpen(actor: AuthUser, id: string) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: { room: { select: { number: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED') {
      throw new BadRequestException('El ticket ya está cerrado');
    }
    return ticket;
  }
}

function place(t: { room: { number: string } | null; area: string | null }) {
  return t.room ? `la habitación ${t.room.number}` : (t.area ?? 'un área');
}
