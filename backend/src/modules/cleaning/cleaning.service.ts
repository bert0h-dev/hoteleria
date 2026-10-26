import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { todayIn, zonedToUtc } from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreateStayoverDto,
  QueryTasksDto,
  UpdateTaskDto,
} from './dto/cleaning.dto.js';

const person = { select: { id: true, name: true } } as const;
const ACTIVE = ['PENDING', 'IN_PROGRESS'] as const;

const taskInclude = {
  room: {
    select: {
      id: true,
      number: true,
      floor: true,
      status: true,
      roomType: { select: { name: true } },
    },
  },
  assignedTo: person,
  requestedBy: person,
  finishedBy: person,
} satisfies Prisma.CleaningTaskInclude;

/** Tareas de limpieza: asignar, tomar, empezar y terminar. */
@Injectable()
export class CleaningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Activas: todas (lista común). Terminadas: las de hoy; Limpieza solo ve
   * las suyas.
   */
  async list(actor: AuthUser, query: QueryTasksDto) {
    if (query.scope === 'done') {
      const { timezone } = await this.prisma.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { timezone: true },
      });
      return this.prisma.cleaningTask.findMany({
        where: {
          hotelId: actor.hotelId,
          status: 'DONE',
          finishedAt: {
            gte: zonedToUtc(todayIn(timezone), '00:00', timezone),
          },
          ...(actor.role === 'HOUSEKEEPING' && { finishedById: actor.id }),
        },
        include: taskInclude,
        orderBy: { finishedAt: 'desc' },
      });
    }
    return this.prisma.cleaningTask.findMany({
      where: { hotelId: actor.hotelId, status: { in: [...ACTIVE] } },
      include: taskInclude,
      orderBy: [{ isPriority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Repaso a pedido de una habitación ocupada. */
  async createStayover(actor: AuthUser, dto: CreateStayoverDto) {
    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, hotelId: actor.hotelId, isActive: true },
    });
    if (!room) throw new NotFoundException('Habitación no encontrada');
    if (room.status !== 'OCCUPIED') {
      throw new BadRequestException(
        'El repaso solo se pide para habitaciones ocupadas',
      );
    }
    if (dto.assignedToId) await this.assertHousekeeper(actor, dto.assignedToId);
    try {
      const task = await this.prisma.cleaningTask.create({
        data: {
          hotelId: actor.hotelId,
          roomId: room.id,
          kind: 'STAYOVER',
          isPriority: dto.isPriority ?? false,
          notes: dto.notes ?? null,
          assignedToId: dto.assignedToId ?? null,
          requestedById: actor.id,
        },
        include: taskInclude,
      });
      return task;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `La habitación ${room.number} ya tiene una limpieza pendiente`,
        );
      }
      throw error;
    }
  }

  /** Asignar, cambiar prioridad o nota (ADMIN y recepción). */
  async update(actor: AuthUser, id: string, dto: UpdateTaskDto) {
    await this.findActive(actor, id);
    if (dto.assignedToId) await this.assertHousekeeper(actor, dto.assignedToId);
    return this.prisma.cleaningTask.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        isPriority: dto.isPriority,
        notes: dto.notes,
      },
      include: taskInclude,
    });
  }

  /** Tomar una tarea de la lista común. */
  async take(actor: AuthUser, id: string) {
    const task = await this.findActive(actor, id);
    this.assertCanWork(actor, task);
    return this.prisma.cleaningTask.update({
      where: { id },
      data: { assignedToId: actor.id },
      include: taskInclude,
    });
  }

  async start(actor: AuthUser, id: string) {
    const task = await this.findActive(actor, id);
    if (task.status !== 'PENDING') {
      throw new BadRequestException('Esta limpieza ya se empezó');
    }
    this.assertCanWork(actor, task);
    return this.prisma.cleaningTask.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        // Quien la empieza la toma (si es de limpieza y estaba libre).
        assignedToId:
          task.assignedToId ??
          (actor.role === 'HOUSEKEEPING' ? actor.id : null),
      },
      include: taskInclude,
    });
  }

  /**
   * Termina la limpieza. La de salida deja la habitación Disponible y
   * registra quién la limpió.
   */
  async finish(actor: AuthUser, id: string) {
    const task = await this.findActive(actor, id);
    this.assertCanWork(actor, task);
    // Limpieza firma la suya; recepción/ADMIN la cierran a nombre del asignado.
    const cleanerId =
      actor.role === 'HOUSEKEEPING'
        ? actor.id
        : (task.assignedToId ?? actor.id);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.cleaningTask.updateMany({
        where: { id, status: { in: [...ACTIVE] } },
        data: { status: 'DONE', finishedAt: now, finishedById: cleanerId },
      });
      if (!count) throw new ConflictException('Esta limpieza ya se cerró');

      if (task.kind === 'DEPARTURE') {
        const room = await tx.room.updateMany({
          where: { id: task.roomId, status: 'CLEANING' },
          data: {
            status: 'AVAILABLE',
            lastCleanedAt: now,
            lastCleanedById: cleanerId,
          },
        });
        if (!room.count) {
          throw new ConflictException(
            'La habitación ya no está en Limpieza. Actualiza e inténtalo de nuevo.',
          );
        }
        await tx.roomStatusLog.create({
          data: {
            hotelId: actor.hotelId,
            roomId: task.roomId,
            fromStatus: 'CLEANING',
            toStatus: 'AVAILABLE',
            changedById: actor.id,
            cleanedById: cleanerId,
            cleanedAt: now,
            cleaningTaskId: id,
          },
        });
      }
    });
    return this.prisma.cleaningTask.findUniqueOrThrow({
      where: { id },
      include: taskInclude,
    });
  }

  /** Cancelar un repaso (la limpieza de salida no se cancela). */
  async cancel(actor: AuthUser, id: string, reason: string) {
    const task = await this.findActive(actor, id);
    if (task.kind === 'DEPARTURE') {
      throw new BadRequestException(
        'La limpieza de salida no se cancela; se cierra al dejar la habitación limpia',
      );
    }
    return this.prisma.cleaningTask.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      include: taskInclude,
    });
  }

  // -------------------------------------------------------------------------

  private async findActive(actor: AuthUser, id: string) {
    const task = await this.prisma.cleaningTask.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: { assignedTo: person },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      throw new BadRequestException('Esta limpieza ya se cerró');
    }
    return task;
  }

  /** Limpieza solo trabaja tareas libres o asignadas a sí misma. */
  private assertCanWork(
    actor: AuthUser,
    task: { assignedToId: string | null; assignedTo: { name: string } | null },
  ) {
    if (
      actor.role === 'HOUSEKEEPING' &&
      task.assignedToId &&
      task.assignedToId !== actor.id
    ) {
      throw new ForbiddenException(
        `Esta limpieza está asignada a ${task.assignedTo?.name ?? 'otra persona'}`,
      );
    }
  }

  private async assertHousekeeper(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        hotelId: actor.hotelId,
        role: 'HOUSEKEEPING',
        isActive: true,
      },
    });
    if (!user) {
      throw new BadRequestException(
        'Solo se puede asignar a personal de limpieza activo',
      );
    }
  }
}
