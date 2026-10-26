import { useState } from 'react';
import { ChevronLeft, ChevronRight, LogIn, LogOut, Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReservationDetailsDialog } from '@/features/reservations/components/reservation-details-dialog';
import {
  ReservationFormDialog,
  type ReservationPreset,
} from '@/features/reservations/components/reservation-form-dialog';
import { ReservationStatusBadge } from '@/features/reservations/components/reservation-status-badge';
import { useCalendar } from '@/features/reservations/reservations-api';
import {
  unitLabel,
  type CalendarDay,
  type Reservation,
} from '@/features/reservations/types';
import {
  addDays,
  dayParts,
  formatDayTime,
  formatMoney,
  todayInHotel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES = [7, 14, 30] as const;

/** Color del mapa de calor según lo que queda libre. */
function heat(day: CalendarDay) {
  if (day.sellable === 0) return 'bg-muted text-muted-foreground';
  if (day.available === 0)
    return 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300';
  const ratio = day.available / day.sellable;
  if (ratio <= 0.34)
    return 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300';
  return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300';
}

export function ReservationsCalendarPage() {
  const today = todayInHotel();
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<(typeof RANGES)[number]>(14);
  const [preset, setPreset] = useState<ReservationPreset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useCalendar(from, days);
  const todayData = useCalendar(today, 1);

  const arrivals = (todayData.data?.reservations ?? []).filter(
    (r) =>
      r.status === 'CONFIRMED' && todayInHotel(new Date(r.checkIn)) === today,
  );
  const departures = (todayData.data?.reservations ?? []).filter(
    (r) => todayInHotel(new Date(r.checkOut)) === today,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        description="Disponibilidad por tipo de habitación. Haz clic en un día para reservar."
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

      <div className="grid gap-4 md:grid-cols-2">
        <TodayList
          title="Llegadas de hoy"
          icon={LogIn}
          items={arrivals}
          time={(r) => r.checkIn}
          empty="Sin llegadas pendientes hoy."
          onSelect={setSelectedId}
        />
        <TodayList
          title="Salidas de hoy"
          icon={LogOut}
          items={departures}
          time={(r) => r.checkOut}
          empty="Sin salidas hoy."
          onSelect={setSelectedId}
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Periodo anterior"
            onClick={() => setFrom(addDays(from, -days))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Periodo siguiente"
            onClick={() => setFrom(addDays(from, days))}
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom(today)}>
            Hoy
          </Button>
          <p className="ml-1 text-sm font-medium capitalize">
            {dayParts(from).month} {dayParts(from).day} –{' '}
            {dayParts(addDays(from, days - 1)).month}{' '}
            {dayParts(addDays(from, days - 1)).day}
          </p>
          <div className="ml-auto inline-flex gap-1 rounded-lg bg-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground',
                  days === r && 'bg-background text-foreground shadow-sm',
                )}
              >
                {r} días
              </button>
            ))}
          </div>
        </div>

        {/* Mapa de calor: tipos × días */}
        <div
          className={cn(
            'overflow-x-auto transition-opacity',
            isFetching && !isLoading && 'opacity-60',
          )}
        >
          {isLoading || !data ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-40 border-b bg-card p-3 text-left font-medium">
                    Tipo
                  </th>
                  {data.days.map((d) => {
                    const p = dayParts(d);
                    return (
                      <th
                        key={d}
                        className={cn(
                          'min-w-14 border-b p-2 text-center font-normal',
                          p.isWeekend && 'bg-muted/40',
                          d === today && 'bg-primary/10',
                        )}
                      >
                        <span className="block text-[11px] text-muted-foreground capitalize">
                          {p.weekday}
                        </span>
                        <span
                          className={cn(
                            'mx-auto mt-0.5 grid size-7 place-items-center rounded-full font-semibold',
                            d === today && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {p.day}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.roomType.id}>
                    <th className="sticky left-0 z-10 border-b bg-card p-3 text-left font-medium">
                      {row.roomType.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.total}{' '}
                        {row.total === 1 ? 'habitación' : 'habitaciones'}
                      </span>
                    </th>
                    {row.days.map((day) => {
                      const p = dayParts(day.date);
                      const past = day.date < today;
                      return (
                        <td
                          key={day.date}
                          className={cn(
                            'border-b p-1',
                            p.isWeekend && 'bg-muted/40',
                            day.date === today && 'bg-primary/5',
                          )}
                        >
                          <button
                            type="button"
                            disabled={past || day.available === 0}
                            onClick={() =>
                              setPreset({
                                roomTypeId: row.roomType.id,
                                arrivalDate: day.date,
                              })
                            }
                            title={`${day.available} de ${day.sellable} disponibles`}
                            className={cn(
                              'flex h-11 w-full flex-col items-center justify-center rounded-lg ring-1 ring-transparent ring-inset transition-all',
                              heat(day),
                              !past &&
                                day.available > 0 &&
                                'hover:scale-105 hover:shadow-md',
                              past && 'opacity-40',
                            )}
                          >
                            <span className="text-sm leading-none font-bold">
                              {day.available}
                            </span>
                            <span className="text-[10px] leading-tight opacity-70">
                              de {day.sellable}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-3 text-xs text-muted-foreground">
          <Legend className="bg-emerald-500/30" label="Disponible" />
          <Legend className="bg-amber-500/40" label="Quedan pocas" />
          <Legend className="bg-rose-500/40" label="Lleno" />
          <span className="ml-auto">
            Cada celda: habitaciones libres de las vendibles ese día.
          </span>
        </div>
      </Card>

      {/* Reservas del periodo */}
      {data && data.reservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reservas del periodo</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {data.reservations.map((r) => (
              <ReservationRow
                key={r.id}
                reservation={r}
                onSelect={setSelectedId}
              />
            ))}
          </CardContent>
        </Card>
      )}

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

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-3 rounded', className)} />
      {label}
    </span>
  );
}

function ReservationRow({
  reservation: r,
  onSelect,
}: {
  reservation: Reservation;
  onSelect: (id: string) => void;
}) {
  const name = `${r.guest.firstName} ${r.guest.lastName}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(r.id)}
      className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <UserAvatar name={name} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {name}{' '}
          <span className="font-mono text-xs text-muted-foreground">
            {r.code}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {r.roomType.name} · {formatDayTime(r.checkIn)} →{' '}
          {formatDayTime(r.checkOut)} · {unitLabel(r.modality, r.units)}
        </p>
      </div>
      <span className="hidden text-sm font-semibold tabular-nums sm:block">
        {formatMoney(r.totalAmount)}
      </span>
      <ReservationStatusBadge status={r.status} />
    </button>
  );
}

function TodayList({
  title,
  icon: Icon,
  items,
  time,
  empty,
  onSelect,
}: {
  title: string;
  icon: typeof LogIn;
  items: Reservation[];
  time: (r: Reservation) => string;
  empty: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
        {items.slice(0, 5).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted/60"
          >
            <span className="w-12 font-mono text-xs text-muted-foreground">
              {formatDayTime(time(r)).split(', ')[1]}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.guest.firstName} {r.guest.lastName}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.roomType.name}
            </span>
          </button>
        ))}
        {items.length > 5 && (
          <p className="px-2 text-xs text-muted-foreground">
            y {items.length - 5} más…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
