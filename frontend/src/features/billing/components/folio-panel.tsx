import { useState } from 'react';
import { Link } from 'react-router';
import {
  BadgePercent,
  Ban,
  Check,
  CircleAlert,
  Clock,
  Plus,
  Printer,
  ReceiptText,
  Undo2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';
import { formatCents, formatDateTime, formatUsdCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFolio, useResolveStayCharge } from '../billing-api';
import { PAYMENT_METHODS, type Folio } from '../types';
import {
  ChargeDialog,
  DiscountDialog,
  PaymentDialog,
  RefundDialog,
  VoidDialog,
  WaiveDialog,
} from './folio-dialogs';

/** Cuenta (folio) de una reserva: saldo, movimientos, cargos sugeridos y pagos. */
export function FolioPanel({ reservationId }: { reservationId: string }) {
  const { data: folio, isLoading } = useFolio(reservationId);
  if (isLoading || !folio) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  return <FolioView folio={folio} />;
}

type Dialog = 'pay' | 'charge' | 'discount' | 'refund' | null;

function FolioView({ folio }: { folio: Folio }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const resolve = useResolveStayCharge(folio.reservation.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [waiving, setWaiving] = useState<Folio['stayCharges'][number] | null>(
    null,
  );
  const [voiding, setVoiding] = useState<{
    type: 'payment' | 'entry';
    id: string;
    label: string;
  } | null>(null);

  const { totals } = folio;
  const status = folio.reservation.status;
  const billable =
    status === 'CONFIRMED' ||
    status === 'CHECKED_IN' ||
    status === 'CHECKED_OUT';
  const suggested = folio.stayCharges.filter((c) => c.status === 'SUGGESTED');
  const close = (open: boolean) => !open && setDialog(null);

  const confirm = async (chargeId: string) => {
    try {
      await resolve.mutateAsync({ chargeId, action: 'CONFIRM' });
      toast.success('Cargo confirmado en la cuenta');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      {/* Saldo */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5',
          totals.balanceCents > 0
            ? 'border-amber-500/40 bg-amber-500/5'
            : totals.balanceCents < 0
              ? 'border-sky-500/40 bg-sky-500/5'
              : 'border-emerald-500/40 bg-emerald-500/5',
        )}
      >
        <div>
          <p className="text-sm text-muted-foreground">
            {totals.balanceCents > 0
              ? 'Saldo pendiente'
              : totals.balanceCents < 0
                ? 'Saldo a favor del huésped'
                : 'Cuenta pagada'}
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {formatCents(Math.abs(totals.balanceCents))}
          </p>
          <p className="text-xs text-muted-foreground">
            Total {formatCents(totals.netCents)} · pagado{' '}
            {formatCents(totals.paidCents - totals.refundedCents)}
          </p>
        </div>
        {billable && (
          <div className="flex flex-wrap gap-2">
            {totals.balanceCents > 0 && (
              <Button
                onClick={() => setDialog('pay')}
                className="shadow-md shadow-primary/20"
              >
                <Wallet />
                Cobrar
              </Button>
            )}
            {totals.balanceCents < 0 && (
              <Button variant="outline" onClick={() => setDialog('refund')}>
                <Undo2 />
                Devolver
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog('charge')}>
              <Plus />
              Cargo
            </Button>
            <Button variant="outline" onClick={() => setDialog('discount')}>
              <BadgePercent />
              Descuento
            </Button>
          </div>
        )}
      </div>

      {folio.reservation.requiresDeposit && status === 'CONFIRMED' && (
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            folio.depositPaid
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
          )}
        >
          {folio.depositPaid ? (
            <Check className="size-4" />
          ) : (
            <CircleAlert className="size-4" />
          )}
          {folio.depositPaid
            ? 'Anticipo recibido'
            : 'Requiere anticipo y aún no se ha pagado'}
        </p>
      )}

      {folio.reservation.balanceDueCents !== null && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
          <p className="font-medium text-rose-700 dark:text-rose-300">
            Salió con saldo de {formatCents(folio.reservation.balanceDueCents)}{' '}
            (cuenta por cobrar)
          </p>
          <p className="text-muted-foreground">
            {folio.reservation.balanceReason} · autorizó{' '}
            {folio.reservation.balanceAuthorizedBy?.name}
          </p>
        </div>
      )}

      {/* Cargos sugeridos */}
      {suggested.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Clock className="size-3.5" />
            Cargos sugeridos
          </h3>
          {suggested.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"
            >
              <span className="flex-1 text-sm">{c.description}</span>
              <span className="font-semibold tabular-nums">
                {formatCents(c.amount * 100)}
              </span>
              {billable && (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => confirm(c.id)}
                    disabled={resolve.isPending}
                  >
                    <Check />
                    Cobrar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWaiving(c)}
                  >
                    Condonar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Movimientos */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <ReceiptText className="size-3.5" />
          Movimientos
        </h3>
        <div className="divide-y rounded-xl border">
          <Line label="Hospedaje" amount={totals.lodgingCents} />
          {folio.entries.map((e) => (
            <Line
              key={e.id}
              label={`${e.description}${e.quantity > 1 ? ` × ${e.quantity}` : ''}`}
              detail={[
                e.reason,
                e.authorizedBy && `autorizó ${e.authorizedBy.name}`,
                `${e.createdBy.name} · ${formatDateTime(e.createdAt)}`,
                e.voided && `cancelado: ${e.voidReason}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              amount={e.kind === 'DISCOUNT' ? -e.amountCents : e.amountCents}
              voided={e.voided}
              onVoid={
                isAdmin && !e.voided
                  ? () =>
                      setVoiding({
                        type: 'entry',
                        id: e.id,
                        label: `${e.description} · ${formatCents(e.amountCents)}`,
                      })
                  : undefined
              }
            />
          ))}
          {folio.stayCharges
            .filter((c) => c.status === 'WAIVED')
            .map((c) => (
              <Line
                key={c.id}
                label={`${c.description} (condonado)`}
                detail={[
                  c.waiveReason,
                  c.authorizedBy && `autorizó ${c.authorizedBy.name}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                amount={0}
              />
            ))}
          <div className="flex justify-between bg-muted/40 px-3 py-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(totals.netCents)}</span>
          </div>
        </div>
      </section>

      {/* Pagos */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <Wallet className="size-3.5" />
          Pagos
        </h3>
        {folio.payments.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aún no hay pagos.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {folio.payments.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5',
                  p.voided && 'opacity-50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      p.voided && 'line-through',
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.receiptNumber}
                    </span>{' '}
                    {p.kind === 'REFUND'
                      ? 'Devolución'
                      : p.isDeposit
                        ? 'Anticipo'
                        : 'Pago'}{' '}
                    · {PAYMENT_METHODS[p.method]}
                    {p.reference && ` · ${p.reference}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.currency === 'USD' &&
                      `${formatUsdCents(p.amountCents)} × ${p.exchangeRate} · `}
                    {p.createdBy.name} · {formatDateTime(p.createdAt)}
                    {p.voided && ` · cancelado: ${p.voidReason}`}
                  </p>
                </div>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    p.kind === 'REFUND' && 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {p.kind === 'REFUND' ? '−' : ''}
                  {formatCents(p.amountMxnCents)}
                </span>
                {!p.voided && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Imprimir recibo ${p.receiptNumber}`}
                    render={
                      <Link
                        to={`/reservas/${folio.reservation.id}/recibo/${p.id}`}
                        target="_blank"
                      />
                    }
                  >
                    <Printer />
                  </Button>
                )}
                {isAdmin && !p.voided && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Cancelar ${p.receiptNumber}`}
                    onClick={() =>
                      setVoiding({
                        type: 'payment',
                        id: p.id,
                        label: `${p.receiptNumber} · ${formatCents(p.amountMxnCents)}`,
                      })
                    }
                  >
                    <Ban />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <PaymentDialog
        folio={folio}
        open={dialog === 'pay'}
        onOpenChange={close}
      />
      <ChargeDialog
        folio={folio}
        open={dialog === 'charge'}
        onOpenChange={close}
      />
      <DiscountDialog
        folio={folio}
        open={dialog === 'discount'}
        onOpenChange={close}
      />
      <RefundDialog
        folio={folio}
        open={dialog === 'refund'}
        onOpenChange={close}
      />
      <WaiveDialog
        folio={folio}
        charge={waiving}
        onOpenChange={(o) => !o && setWaiving(null)}
      />
      <VoidDialog
        folio={folio}
        target={voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
      />
    </div>
  );
}

function Line({
  label,
  detail,
  amount,
  voided,
  onVoid,
}: {
  label: string;
  detail?: string;
  amount: number;
  voided?: boolean;
  onVoid?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5',
        voided && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', voided && 'line-through')}>{label}</p>
        {detail && (
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        )}
      </div>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          amount < 0 && 'text-emerald-600 dark:text-emerald-400',
          voided && 'line-through',
        )}
      >
        {amount < 0 ? '−' : ''}
        {formatCents(Math.abs(amount))}
      </span>
      {onVoid && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cancelar movimiento"
          onClick={onVoid}
        >
          <Ban />
        </Button>
      )}
    </div>
  );
}
