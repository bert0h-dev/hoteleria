import { useState } from 'react';
import { useParams } from 'react-router';
import { Printer } from 'lucide-react';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useFolio } from '@/features/billing/billing-api';
import { PAYMENT_METHODS } from '@/features/billing/types';
import { calculateTaxBreakdown } from '@/features/hotel/pricing';
import { useHotel } from '@/features/hotel/hotel-api';
import {
  formatCents,
  formatDayTime,
  formatMoneyCents,
  formatUsdCents,
  setHotelTimeZone,
} from '@/lib/format';

/** Recibo de un pago (o devolución), para imprimir. */
export function ReceiptPage() {
  const { id, paymentId } = useParams();
  const { data: folio } = useFolio(id);
  const { data: hotel } = useHotel();
  const [printedAt] = useState(() => new Date().toISOString());

  if (!folio || !hotel) return <FullScreenLoader />;
  setHotelTimeZone(hotel.timezone);
  const payment = folio.payments.find((p) => p.id === paymentId);
  if (!payment) return <p className="p-10 text-center">Pago no encontrado.</p>;

  const taxes = calculateTaxBreakdown(
    payment.amountMxnCents / 100,
    hotel.settings,
  );
  const refund = payment.kind === 'REFUND';

  return (
    <div className="min-h-svh bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-md justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
      </div>

      <article className="mx-auto max-w-md space-y-5 bg-white p-8 text-[13px] text-zinc-900 shadow-xl print:shadow-none">
        <header className="space-y-1 border-b border-dashed border-zinc-400 pb-4 text-center">
          <LogoMark className="mx-auto size-10 shadow-none print:[print-color-adjust:exact]" />
          <h1 className="text-lg font-bold">{hotel.name}</h1>
          <p className="text-xs text-zinc-600">
            {[hotel.legalName, hotel.taxId && `RFC ${hotel.taxId}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-xs text-zinc-600">
            {[hotel.address, hotel.phone].filter(Boolean).join(' · ')}
          </p>
        </header>

        <div className="text-center">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">
            {refund ? 'Comprobante de devolución' : 'Recibo de pago'}
          </p>
          <p className="font-mono text-2xl font-bold">
            {payment.receiptNumber}
          </p>
          <p className="text-xs text-zinc-600">
            {formatDayTime(payment.createdAt)}
          </p>
          {payment.voided && (
            <p className="mt-2 rounded bg-rose-100 px-2 py-1 font-bold text-rose-700">
              CANCELADO
            </p>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-zinc-500">Huésped</dt>
          <dd className="text-right font-medium">
            {folio.reservation.guest.firstName}{' '}
            {folio.reservation.guest.lastName}
          </dd>
          <dt className="text-zinc-500">Reserva</dt>
          <dd className="text-right font-mono">{folio.reservation.code}</dd>
          {folio.reservation.room && (
            <>
              <dt className="text-zinc-500">Habitación</dt>
              <dd className="text-right">{folio.reservation.room.number}</dd>
            </>
          )}
          <dt className="text-zinc-500">Método</dt>
          <dd className="text-right">
            {PAYMENT_METHODS[payment.method]}
            {payment.reference && ` · ${payment.reference}`}
          </dd>
          {payment.isDeposit && (
            <>
              <dt className="text-zinc-500">Concepto</dt>
              <dd className="text-right">Anticipo</dd>
            </>
          )}
        </dl>

        <div className="space-y-1 border-y border-dashed border-zinc-400 py-3">
          {payment.currency === 'USD' && (
            <p className="flex justify-between text-zinc-600">
              <span>
                {formatUsdCents(payment.amountCents)} × {payment.exchangeRate}
              </span>
              <span>tipo de cambio</span>
            </p>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">
              {refund ? 'Devuelto' : 'Recibido'}
            </span>
            <span className="text-2xl font-bold">
              {formatCents(payment.amountMxnCents)}
            </span>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-xs text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="text-right">{formatMoneyCents(taxes.subtotal)}</dd>
            <dt>IVA</dt>
            <dd className="text-right">{formatMoneyCents(taxes.vat)}</dd>
            <dt>ISH</dt>
            <dd className="text-right">{formatMoneyCents(taxes.lodgingTax)}</dd>
          </dl>
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
          <dt className="text-zinc-600">Total de la cuenta</dt>
          <dd className="text-right">{formatCents(folio.totals.netCents)}</dd>
          <dt className="text-zinc-600">Pagado a la fecha</dt>
          <dd className="text-right">
            {formatCents(folio.totals.paidCents - folio.totals.refundedCents)}
          </dd>
          <dt className="font-semibold">Saldo</dt>
          <dd className="text-right font-semibold">
            {formatCents(folio.totals.balanceCents)}
          </dd>
        </dl>

        <footer className="space-y-1 pt-6 text-center text-[11px] text-zinc-500">
          <p>Atendió: {payment.createdBy.name}</p>
          <p>Este recibo no es un comprobante fiscal (CFDI).</p>
          <p>Impreso el {formatDayTime(printedAt)}</p>
        </footer>
      </article>
    </div>
  );
}
