import type { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const ACTIVE = ['PENDING', 'IN_PROGRESS'] as const;

/**
 * La habitación quedó sucia (check-out, cambio de habitación o paso manual
 * a Limpieza): cancela cualquier repaso pendiente y crea la tarea de salida.
 */
export async function openDepartureTask(
  tx: Tx,
  input: { hotelId: string; roomId: string; requestedById: string },
) {
  const active = await tx.cleaningTask.findFirst({
    where: { roomId: input.roomId, status: { in: [...ACTIVE] } },
  });
  if (active?.kind === 'DEPARTURE') return active.id;
  if (active) {
    await tx.cleaningTask.update({
      where: { id: active.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Se reemplazó por la limpieza de salida',
      },
    });
  }
  const task = await tx.cleaningTask.create({
    data: {
      hotelId: input.hotelId,
      roomId: input.roomId,
      kind: 'DEPARTURE',
      requestedById: input.requestedById,
    },
  });
  return task.id;
}

/**
 * La habitación se marcó limpia desde el tablero: cierra su tarea de salida
 * (si la hay) a nombre de quien limpió. Devuelve el id de la tarea.
 */
export async function completeDepartureTask(
  tx: Tx,
  input: { roomId: string; cleanedById: string; at: Date },
): Promise<string | null> {
  const task = await tx.cleaningTask.findFirst({
    where: {
      roomId: input.roomId,
      kind: 'DEPARTURE',
      status: { in: [...ACTIVE] },
    },
  });
  if (!task) return null;
  await tx.cleaningTask.update({
    where: { id: task.id },
    data: {
      status: 'DONE',
      finishedAt: input.at,
      finishedById: input.cleanedById,
    },
  });
  return task.id;
}

/** La habitación salió de Limpieza por otro motivo (p. ej. mantenimiento). */
export async function cancelActiveTasks(
  tx: Tx,
  input: { roomId: string; reason: string },
) {
  await tx.cleaningTask.updateMany({
    where: { roomId: input.roomId, status: { in: [...ACTIVE] } },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: input.reason,
    },
  });
}
