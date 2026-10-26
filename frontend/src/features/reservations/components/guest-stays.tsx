import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayTime, formatMoney } from '@/lib/format';
import { useReservations } from '../reservations-api';
import { unitLabel } from '../types';
import { ReservationDetailsDialog } from './reservation-details-dialog';
import { ReservationStatusBadge } from './reservation-status-badge';

/** Historial de reservas de un huésped (para su ficha). */
export function GuestStays({ guestId }: { guestId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useReservations({ page: 1, limit: 10, guestId });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data?.data.length) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Aún no tiene reservas.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {data.data.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.code}
                  </span>{' '}
                  {r.roomType.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDayTime(r.checkIn)} · {unitLabel(r.modality, r.units)}{' '}
                  · {formatMoney(r.totalAmount)}
                </p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </button>
          </li>
        ))}
      </ul>
      {data.total > data.data.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando las {data.data.length} más recientes de {data.total}.
        </p>
      )}
      <ReservationDetailsDialog
        reservationId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </>
  );
}
