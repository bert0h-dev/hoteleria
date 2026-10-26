import { PAYMENT_METHODS } from '@/features/billing/types';
import { formatCents, formatUsdCents } from '@/lib/format';
import type { ShiftTotals } from '../types';

/** Totales del turno por método y moneda. */
export function ShiftTotalsTable({ totals }: { totals: ShiftTotals }) {
  if (totals.byMethod.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Aún no hay cobros en este turno.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 font-medium">Método</th>
          <th className="py-2 text-right font-medium">Mov.</th>
          <th className="py-2 text-right font-medium">Cobrado</th>
          <th className="py-2 text-right font-medium">Devuelto</th>
          <th className="py-2 text-right font-medium">Neto (MXN)</th>
        </tr>
      </thead>
      <tbody>
        {totals.byMethod.map((row) => {
          const fmt = row.currency === 'USD' ? formatUsdCents : formatCents;
          return (
            <tr key={`${row.method}:${row.currency}`} className="border-b">
              <td className="py-2">
                {PAYMENT_METHODS[row.method]}
                {row.currency === 'USD' && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (dólares)
                  </span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{row.count}</td>
              <td className="py-2 text-right tabular-nums">
                {fmt(row.paymentsCents)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {row.refundsCents ? fmt(row.refundsCents) : '—'}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {formatCents(row.netMxnCents)}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} className="pt-2 font-semibold">
            Total neto
          </td>
          <td className="pt-2 text-right font-semibold tabular-nums">
            {formatCents(totals.netMxnCents)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
