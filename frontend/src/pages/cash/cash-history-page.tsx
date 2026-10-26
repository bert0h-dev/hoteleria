import { useState } from 'react';
import { Link } from 'react-router';
import { FileText, LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useShifts } from '@/features/cash/cash-api';
import { CloseShiftDialog } from '@/features/cash/components/shift-dialogs';
import type { CashShift } from '@/features/cash/types';
import { formatCents, formatDayTime, formatUsdCents } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const FILTERS = [
  { value: undefined, label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'closed', label: 'Cerrados' },
] as const;

/** Historial de turnos y cortes (ADMIN). */
export function CashHistoryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'open' | 'closed' | undefined>();
  const { data, isLoading } = useShifts({ page, limit: PAGE_SIZE, status });
  const [closing, setClosing] = useState<CashShift | null>(null);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cortes de caja"
        description="Turnos de todo el personal; puedes cerrar los que quedaron abiertos."
      />
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.value ? 'default' : 'outline'}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Apertura</th>
              <th className="px-4 py-3 font-medium">Cierre</th>
              <th className="px-4 py-3 text-right font-medium">Cobros</th>
              <th className="px-4 py-3 text-right font-medium">Diferencia</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4">
                  <Skeleton className="h-24 w-full" />
                </td>
              </tr>
            )}
            {data?.data.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-muted-foreground"
                >
                  No hay turnos.
                </td>
              </tr>
            )}
            {data?.data.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.user.name}</td>
                <td className="px-4 py-3">{formatDayTime(s.openedAt)}</td>
                <td className="px-4 py-3">
                  {s.closedAt ? (
                    <>
                      {formatDayTime(s.closedAt)}
                      {s.closedBy && s.closedBy.id !== s.user.id && (
                        <span className="block text-xs text-muted-foreground">
                          por {s.closedBy.name}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Abierto
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s._count?.payments ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <Difference shift={s} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {!s.closedAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClosing(s)}
                      >
                        <LockKeyhole />
                        Cerrar
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Ver reporte"
                      render={
                        <Link to={`/caja/turnos/${s.id}`} target="_blank" />
                      }
                    >
                      <FileText />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      <CloseShiftDialog
        shift={closing}
        onOpenChange={(o) => !o && setClosing(null)}
      />
    </div>
  );
}

function Difference({ shift: s }: { shift: CashShift }) {
  if (!s.closedAt || s.expectedMxnCents === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const mxn = (s.countedMxnCents ?? 0) - s.expectedMxnCents;
  const usd = (s.countedUsdCents ?? 0) - (s.expectedUsdCents ?? 0);
  if (mxn === 0 && usd === 0) {
    return <span className="text-emerald-600">Cuadra</span>;
  }
  return (
    <span className="space-y-0.5 tabular-nums">
      {mxn !== 0 && (
        <span
          className={cn('block', mxn < 0 ? 'text-rose-600' : 'text-amber-600')}
        >
          {mxn > 0 ? '+' : '−'}
          {formatCents(Math.abs(mxn))}
        </span>
      )}
      {usd !== 0 && (
        <span
          className={cn('block', usd < 0 ? 'text-rose-600' : 'text-amber-600')}
        >
          {usd > 0 ? '+' : '−'}
          {formatUsdCents(Math.abs(usd))}
        </span>
      )}
    </span>
  );
}
