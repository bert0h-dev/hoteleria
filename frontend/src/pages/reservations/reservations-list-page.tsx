import { useState } from 'react';
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReservationDetailsDialog } from '@/features/reservations/components/reservation-details-dialog';
import {
  ReservationFormDialog,
  type ReservationPreset,
} from '@/features/reservations/components/reservation-form-dialog';
import { ReservationStatusBadge } from '@/features/reservations/components/reservation-status-badge';
import { useReservations } from '@/features/reservations/reservations-api';
import {
  RESERVATION_STATUS,
  SOURCES,
  unitLabel,
  type ReservationStatus,
} from '@/features/reservations/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api';
import { formatDayTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

export function ReservationsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReservationStatus | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState<ReservationPreset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debounced = useDebouncedValue(search.trim());
  const { data, isLoading, isFetching, isError, error } = useReservations({
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
    status: status ?? undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        description="Busca por folio, nombre o teléfono del huésped."
        actions={
          <Button
            onClick={() => setPreset({})}
            className="shadow-md shadow-primary/20"
          >
            <Plus />
            Nueva reserva
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden p-0">
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Folio (R-000123 o 123), nombre o teléfono…"
                className="pl-9"
                aria-label="Buscar reservas"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Llegada</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  resetPage();
                }}
                className="w-auto"
                aria-label="Llegada desde"
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  resetPage();
                }}
                className="w-auto"
                aria-label="Llegada hasta"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={!status}
              onClick={() => {
                setStatus(null);
                resetPage();
              }}
            >
              Todas
            </Chip>
            {(Object.keys(RESERVATION_STATUS) as ReservationStatus[]).map(
              (s) => (
                <Chip
                  key={s}
                  active={status === s}
                  onClick={() => {
                    setStatus(s);
                    resetPage();
                  }}
                >
                  {RESERVATION_STATUS[s].label}
                </Chip>
              ),
            )}
          </div>
        </div>

        <div
          className={cn(
            'transition-opacity',
            isFetching && !isLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Folio</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead className="hidden md:table-cell">Estancia</TableHead>
                <TableHead className="hidden lg:table-cell">Origen</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-4">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <TableCell
                        key={j}
                        className={j === 0 ? 'pl-4' : undefined}
                      >
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {data?.data.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell className="pl-4 font-mono text-sm">
                    {r.code}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {r.guest.firstName} {r.guest.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.roomType.name}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    <p>
                      {formatDayTime(r.checkIn)} → {formatDayTime(r.checkOut)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unitLabel(r.modality, r.units)} · {r.adults + r.children}{' '}
                      {r.adults + r.children === 1 ? 'persona' : 'personas'}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {SOURCES[r.source]}
                    {r.requiresDeposit && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <Wallet className="size-3" />
                        Requiere anticipo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(r.totalAmount)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && (isError || data?.data.length === 0) && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarX2 className="size-6" />
              </div>
              {isError ? (
                <p className="text-sm text-destructive">
                  {getErrorMessage(error)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay reservas con esos filtros.
                </p>
              )}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              {total} {total === 1 ? 'reserva' : 'reservas'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ReservationFormDialog
        open={!!preset}
        onOpenChange={(open) => !open && setPreset(null)}
        preset={preset ?? undefined}
        onSaved={(r) => setSelectedId(r.id)}
      />
      <ReservationDetailsDialog
        reservationId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted',
        active &&
          'border-primary bg-primary/10 text-primary hover:bg-primary/15',
      )}
    >
      {children}
    </button>
  );
}
