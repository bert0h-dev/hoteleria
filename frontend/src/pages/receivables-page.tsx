import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReceivables } from '@/features/cash/cash-api';
import { ReservationDetailsDialog } from '@/features/reservations/components/reservation-details-dialog';
import { formatCents, formatDayTime } from '@/lib/format';

/** Huéspedes que salieron con saldo pendiente. */
export function ReceivablesPage() {
  const { data, isLoading } = useReceivables();
  const [detailId, setDetailId] = useState<string | null>(null);
  const total = data?.reduce((sum, r) => sum + r.balanceCents, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas por cobrar"
        description="Salidas con saldo pendiente. Abre la cuenta para registrar el pago."
      />

      <Card className="flex-row items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <HandCoins className="size-5" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">
            Total por cobrar ({data?.length ?? 0})
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCents(total)}
          </p>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Huésped</th>
              <th className="px-4 py-3 font-medium">Salida</th>
              <th className="px-4 py-3 font-medium">Motivo</th>
              <th className="px-4 py-3 font-medium">Autorizó</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-4">
                  <Skeleton className="h-20 w-full" />
                </td>
              </tr>
            )}
            {data?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-muted-foreground"
                >
                  No hay cuentas por cobrar. 🎉
                </td>
              </tr>
            )}
            {data?.map((r) => (
              <tr
                key={r.id}
                onClick={() => setDetailId(r.id)}
                className="cursor-pointer border-t hover:bg-muted/50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {r.guest.firstName} {r.guest.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{r.code}</span>
                    {r.room && ` · hab. ${r.room.number}`}
                    {r.guest.phone && ` · ${r.guest.phone}`}
                  </p>
                </td>
                <td className="px-4 py-3">{formatDayTime(r.checkedOutAt)}</td>
                <td className="max-w-64 px-4 py-3 text-muted-foreground">
                  {r.balanceReason}
                </td>
                <td className="px-4 py-3">
                  {r.balanceAuthorizedBy?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700 tabular-nums dark:text-amber-300">
                  {formatCents(r.balanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ReservationDetailsDialog
        reservationId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}
