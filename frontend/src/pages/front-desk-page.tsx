import { useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  CalendarPlus,
  DoorOpen,
  LogIn,
  LogOut,
  Printer,
  Repeat,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { GuestBadges } from '@/features/guests/components/guest-badges';
import { ReservationDetailsDialog } from '@/features/reservations/components/reservation-details-dialog';
import { ReservationFormDialog } from '@/features/reservations/components/reservation-form-dialog';
import {
  CheckInDialog,
  CheckOutDialog,
  ExtendStayDialog,
  GuestsDialog,
  MoveRoomDialog,
} from '@/features/reservations/components/stay-dialogs';
import {
  useFrontDesk,
  useNoShow,
} from '@/features/reservations/reservations-api';
import { unitLabel, type Reservation } from '@/features/reservations/types';
import { getErrorMessage } from '@/lib/api';
import { formatCents, formatDayTime, todayInHotel } from '@/lib/format';
import { cn } from '@/lib/utils';

type Action = 'check-in' | 'check-out' | 'extend' | 'move' | 'guests';

export function FrontDeskPage() {
  const { data, isLoading } = useFrontDesk();
  const noShow = useNoShow();
  const [action, setAction] = useState<{
    type: Action;
    reservation: Reservation;
  } | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const open = (type: Action) => (reservation: Reservation) =>
    setAction({ type, reservation });
  const close = () => setAction(null);
  const dialogFor = (type: Action) =>
    action?.type === type ? action.reservation : null;

  const inHouse = data?.inHouse ?? [];
  const departing = inHouse.filter((r) => r.departsToday || r.overdue);
  const overdue = inHouse.filter((r) => r.overdue);

  const markNoShow = async (r: Reservation) => {
    try {
      await noShow.mutateAsync(r.id);
      toast.success(`${r.code}: no se presentó`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const stats = [
    {
      label: 'Llegadas pendientes',
      value: data?.arrivals.length,
      icon: LogIn,
      tone: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
    },
    {
      label: 'En casa',
      value: inHouse.length,
      icon: BedDouble,
      tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    },
    {
      label: 'Salen hoy',
      value: departing.length,
      icon: LogOut,
      tone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    },
    {
      label: 'Salidas vencidas',
      value: overdue.length,
      icon: AlertTriangle,
      tone: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepción"
        description={`Operación del día · ${data ? formatToday(data.today) : ''}`}
        actions={
          <Button
            onClick={() => setWalkIn(true)}
            className="shadow-md shadow-primary/20"
          >
            <UserPlus />
            Llegada sin reserva
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            {...s}
            value={s.value ?? 0}
            loading={isLoading}
          />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Llegadas */}
        <Panel title="Llegadas" icon={LogIn} count={data?.arrivals.length}>
          {isLoading && <Rows />}
          {data?.arrivals.length === 0 && (
            <Empty text="No hay llegadas pendientes hoy." />
          )}
          {data?.arrivals.map((r) => {
            const late = todayInHotel(new Date(r.checkIn)) < data.today;
            return (
              <StayRow
                key={r.id}
                reservation={r}
                onOpen={() => setDetailId(r.id)}
                meta={
                  <>
                    {r.roomType.name} · llega {formatDayTime(r.checkIn)}
                    {late && (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {' '}
                        · atrasada
                      </span>
                    )}
                  </>
                }
                actions={
                  <Button size="sm" onClick={() => open('check-in')(r)}>
                    <DoorOpen />
                    Check-in
                  </Button>
                }
              />
            );
          })}
        </Panel>

        {/* En casa */}
        <Panel title="En casa" icon={BedDouble} count={inHouse.length}>
          {isLoading && <Rows />}
          {inHouse.length === 0 && !isLoading && (
            <Empty text="No hay huéspedes en casa." />
          )}
          {inHouse.map((r) => (
            <StayRow
              key={r.id}
              reservation={r}
              room={r.room?.number}
              highlight={
                r.overdue ? 'overdue' : r.departsToday ? 'today' : undefined
              }
              onOpen={() => setDetailId(r.id)}
              meta={
                <>
                  sale {formatDayTime(r.checkOut)} ·{' '}
                  {unitLabel(r.modality, r.units)}
                  {r.balanceCents > 0 && (
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      {' '}
                      · debe {formatCents(r.balanceCents)}
                    </span>
                  )}
                  {r.overdue && (
                    <span className="font-medium text-rose-600 dark:text-rose-400">
                      {' '}
                      · salida vencida
                    </span>
                  )}
                  {!r.overdue && r.departsToday && (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {' '}
                      · sale hoy
                    </span>
                  )}
                </>
              }
              actions={
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Personas"
                    onClick={() => open('guests')(r)}
                  >
                    <Users />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Extender estancia"
                    onClick={() => open('extend')(r)}
                  >
                    <CalendarPlus />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Cambiar de habitación"
                    onClick={() => open('move')(r)}
                  >
                    <Repeat />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Imprimir tarjeta de registro"
                    render={
                      <Link to={`/reservas/${r.id}/registro`} target="_blank" />
                    }
                  >
                    <Printer />
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      r.overdue || r.departsToday ? 'default' : 'outline'
                    }
                    onClick={() => open('check-out')(r)}
                  >
                    <LogOut />
                    Check-out
                  </Button>
                </>
              }
            />
          ))}
        </Panel>
      </div>

      {!!data?.noShowCandidates.length && (
        <Panel
          title="No llegaron"
          icon={UserX}
          count={data.noShowCandidates.length}
        >
          <p className="px-1 pb-2 text-sm text-muted-foreground">
            Su estancia ya terminó sin check-in. Márcalas para liberar la
            disponibilidad.
          </p>
          {data.noShowCandidates.map((r) => (
            <StayRow
              key={r.id}
              reservation={r}
              onOpen={() => setDetailId(r.id)}
              meta={
                <>
                  {r.roomType.name} · debía llegar {formatDayTime(r.checkIn)}
                </>
              }
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markNoShow(r)}
                  disabled={noShow.isPending}
                >
                  <UserX />
                  No se presentó
                </Button>
              }
            />
          ))}
        </Panel>
      )}

      <CheckInDialog
        reservation={dialogFor('check-in')}
        onOpenChange={(o) => !o && close()}
      />
      <CheckOutDialog
        reservation={dialogFor('check-out')}
        onOpenChange={(o) => !o && close()}
      />
      <ExtendStayDialog
        reservation={dialogFor('extend')}
        onOpenChange={(o) => !o && close()}
      />
      <GuestsDialog
        reservation={dialogFor('guests')}
        onOpenChange={(o) => !o && close()}
      />
      <MoveRoomDialog
        reservation={dialogFor('move')}
        onOpenChange={(o) => !o && close()}
      />
      <ReservationFormDialog open={walkIn} onOpenChange={setWalkIn} walkIn />
      <ReservationDetailsDialog
        reservationId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}

function formatToday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function Panel({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof LogIn;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {count ?? 0}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function StayRow({
  reservation: r,
  room,
  meta,
  actions,
  highlight,
  onOpen,
}: {
  reservation: Reservation;
  room?: string;
  meta: React.ReactNode;
  actions: React.ReactNode;
  highlight?: 'today' | 'overdue';
  onOpen: () => void;
}) {
  const name = `${r.guest.firstName} ${r.guest.lastName}`;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors',
        highlight === 'overdue' && 'border-rose-500/40 bg-rose-500/5',
        highlight === 'today' && 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      {room ? (
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border-2 bg-background text-lg font-bold tabular-nums">
          {room}
        </div>
      ) : (
        <UserAvatar name={name} />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className="flex flex-wrap items-center gap-2 font-medium hover:underline">
          {name}
          <GuestBadges guest={r.guest} />
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {r.code}
          </span>
        </p>
        <p className="truncate text-sm text-muted-foreground">{meta}</p>
      </button>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}

function Rows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
