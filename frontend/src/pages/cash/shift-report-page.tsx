import { useState } from 'react';
import { useParams } from 'react-router';
import { Printer } from 'lucide-react';
import { DocumentNotFound } from '@/components/document-not-found';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHODS } from '@/features/billing/types';
import { useShift } from '@/features/cash/cash-api';
import { ShiftTotalsTable } from '@/features/cash/components/shift-totals';
import { useHotel } from '@/features/hotel/hotel-api';
import {
  formatCents,
  formatDayTime,
  formatUsdCents,
  setHotelTimeZone,
} from '@/lib/format';

/** Reporte del turno / corte de caja, para imprimir. */
export function ShiftReportPage() {
  const { id } = useParams();
  const { data: shift, error } = useShift(id);
  const { data: hotel } = useHotel();
  const [printedAt] = useState(() => new Date().toISOString());

  if (error) return <DocumentNotFound message="Turno no encontrado" />;
  if (!shift || !hotel) return <FullScreenLoader />;
  setHotelTimeZone(hotel.timezone);
  const t = shift.totals;
  const closed = !!shift.closedAt;
  const diffMxn = (shift.countedMxnCents ?? 0) - (shift.expectedMxnCents ?? 0);
  const diffUsd = (shift.countedUsdCents ?? 0) - (shift.expectedUsdCents ?? 0);

  return (
    <div className="min-h-svh bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-2xl justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
      </div>

      <article className="mx-auto max-w-2xl space-y-6 bg-white p-8 text-[13px] text-zinc-900 shadow-xl print:shadow-none">
        <header className="flex items-center gap-3 border-b border-zinc-300 pb-4">
          <LogoMark className="size-10 shadow-none print:[print-color-adjust:exact]" />
          <div className="flex-1">
            <h1 className="text-lg font-bold">{hotel.name}</h1>
            <p className="text-xs text-zinc-600">
              {closed ? 'Corte de caja' : 'Turno de caja (abierto)'}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <p className="font-semibold text-zinc-900">{shift.user.name}</p>
            <p>Abrió {formatDayTime(shift.openedAt)}</p>
            {shift.closedAt && <p>Cerró {formatDayTime(shift.closedAt)}</p>}
            {shift.closedBy && shift.closedBy.id !== shift.userId && (
              <p>Cerrado por {shift.closedBy.name}</p>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4">
          <Box title="Pesos">
            <Line
              label="Fondo inicial"
              value={formatCents(shift.openingMxnCents)}
            />
            <Line
              label="Esperado"
              value={formatCents(t.expectedMxnCents)}
              bold
            />
            {closed && (
              <>
                <Line
                  label="Contado"
                  value={formatCents(shift.countedMxnCents ?? 0)}
                />
                <Line
                  label="Diferencia"
                  value={signed(diffMxn, formatCents)}
                  bold
                />
              </>
            )}
          </Box>
          <Box title="Dólares">
            <Line
              label="Fondo inicial"
              value={formatUsdCents(shift.openingUsdCents)}
            />
            <Line
              label="Esperado"
              value={formatUsdCents(t.expectedUsdCents)}
              bold
            />
            {closed && (
              <>
                <Line
                  label="Contado"
                  value={formatUsdCents(shift.countedUsdCents ?? 0)}
                />
                <Line
                  label="Diferencia"
                  value={signed(diffUsd, formatUsdCents)}
                  bold
                />
              </>
            )}
          </Box>
        </section>

        {shift.closingNotes && (
          <p className="rounded border border-zinc-300 p-3">
            <span className="font-semibold">Comentario: </span>
            {shift.closingNotes}
          </p>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Resumen por método</h2>
          <ShiftTotalsTable totals={t} />
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">
            Movimientos ({shift.payments.length})
          </h2>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-zinc-500">
                <th className="py-1 font-medium">Recibo</th>
                <th className="py-1 font-medium">Hora</th>
                <th className="py-1 font-medium">Reserva</th>
                <th className="py-1 font-medium">Método</th>
                <th className="py-1 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {shift.payments.map((p) => (
                <tr
                  key={p.id}
                  className={p.voidedAt ? 'text-zinc-400 line-through' : ''}
                >
                  <td className="py-1 font-mono">{p.receiptNumber}</td>
                  <td className="py-1">{formatDayTime(p.createdAt)}</td>
                  <td className="py-1">
                    {p.reservation.code} · {p.reservation.guest.firstName}{' '}
                    {p.reservation.guest.lastName}
                  </td>
                  <td className="py-1">
                    {p.kind === 'REFUND' ? 'Devolución · ' : ''}
                    {PAYMENT_METHODS[p.method]}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {p.currency === 'USD'
                      ? formatUsdCents(p.amountCents)
                      : formatCents(p.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.voidedCount > 0 && (
            <p className="text-xs text-zinc-500">
              Los movimientos tachados están cancelados y no cuentan.
            </p>
          )}
        </section>

        <footer className="grid grid-cols-2 gap-10 pt-10 text-center text-xs text-zinc-600">
          <div className="border-t border-zinc-400 pt-1">
            Entrega: {shift.user.name}
          </div>
          <div className="border-t border-zinc-400 pt-1">Recibe</div>
          <p className="col-span-2 text-[11px] text-zinc-400">
            Impreso {formatDayTime(printedAt)}
          </p>
        </footer>
      </article>
    </div>
  );
}

function signed(cents: number, format: (c: number) => string) {
  if (cents === 0) return format(0);
  return `${cents > 0 ? '+' : '−'}${format(Math.abs(cents))}`;
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded border border-zinc-300 p-3">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-600">{label}</span>
      <span className={bold ? 'font-semibold tabular-nums' : 'tabular-nums'}>
        {value}
      </span>
    </div>
  );
}
