import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { History, LockKeyhole, Printer, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { PAYMENT_METHODS } from '@/features/billing/types';
import { useCurrentShift, useShift } from '@/features/cash/cash-api';
import {
  CloseShiftDialog,
  OpenShiftDialog,
} from '@/features/cash/components/shift-dialogs';
import { ShiftTotalsTable } from '@/features/cash/components/shift-totals';
import type { CashShift } from '@/features/cash/types';
import { formatCents, formatDayTime, formatUsdCents } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Mi turno de caja: fondo, cobros, efectivo esperado y corte. */
export function CashPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { data: shift, isLoading } = useCurrentShift();
  const { data: detail } = useShift(shift?.id);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState<CashShift | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caja"
        description={
          shift
            ? `Turno abierto desde ${formatDayTime(shift.openedAt)}`
            : 'Abre tu turno para poder cobrar'
        }
        actions={
          <>
            {hasRole('ADMIN') && (
              <Button variant="outline" render={<Link to="/caja/cortes" />}>
                <History />
                Cortes
              </Button>
            )}
            {shift && (
              <>
                <Button
                  variant="outline"
                  render={
                    <Link to={`/caja/turnos/${shift.id}`} target="_blank" />
                  }
                >
                  <Printer />
                  Imprimir
                </Button>
                <Button onClick={() => setClosing(shift)}>
                  <LockKeyhole />
                  Hacer corte
                </Button>
              </>
            )}
          </>
        }
      />

      {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

      {!isLoading && !shift && (
        <Card className="items-center gap-4 py-12 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Wallet className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Tu caja está cerrada</p>
            <p className="text-sm text-muted-foreground">
              Abre tu turno con el fondo inicial en pesos y dólares.
            </p>
          </div>
          <Button onClick={() => setOpening(true)}>Abrir turno</Button>
        </Card>
      )}

      {shift?.totals && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Fondo en pesos"
              value={formatCents(shift.openingMxnCents)}
            />
            <Stat
              label="Fondo en dólares"
              value={formatUsdCents(shift.openingUsdCents)}
            />
            <Stat
              label="Efectivo esperado (MXN)"
              value={formatCents(shift.totals.expectedMxnCents)}
              strong
            />
            <Stat
              label="Efectivo esperado (USD)"
              value={formatUsdCents(shift.totals.expectedUsdCents)}
              strong
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">Por método de pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ShiftTotalsTable totals={shift.totals} />
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">Movimientos</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto">
                {!detail && <Skeleton className="h-24 w-full" />}
                {detail?.payments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin movimientos todavía.
                  </p>
                )}
                {detail?.payments.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60',
                      p.voidedAt && 'opacity-50 line-through',
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.receiptNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.reservation.code} · {p.reservation.guest.firstName}{' '}
                      {p.reservation.guest.lastName}
                      <span className="text-muted-foreground">
                        {' '}
                        · {PAYMENT_METHODS[p.method]}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        p.kind === 'REFUND' &&
                          'text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {p.kind === 'REFUND' ? '−' : ''}
                      {p.currency === 'USD'
                        ? formatUsdCents(p.amountCents)
                        : formatCents(p.amountCents)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <OpenShiftDialog open={opening} onOpenChange={setOpening} />
      <CloseShiftDialog
        shift={closing}
        onOpenChange={(o) => !o && setClosing(null)}
        onClosed={(id) => navigate(`/caja/turnos/${id}`)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Card
      className={cn('gap-1 p-4', strong && 'border-primary/40 bg-primary/5')}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </Card>
  );
}
