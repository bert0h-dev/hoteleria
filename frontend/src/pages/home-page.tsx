import { useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CircleAlert,
  Database,
  HandCoins,
  Info,
  LogIn,
  LogOut,
  Server,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { ROLES } from '@/features/auth/roles';
import { OccupancyChart } from '@/features/dashboard/components/occupancy-chart';
import {
  useDashboard,
  type Dashboard,
  type DashboardAlert,
} from '@/features/dashboard/dashboard-api';
import { useHealth } from '@/features/health/use-health';
import { ROOM_STATUS, ROOM_STATUSES } from '@/features/rooms/room-status';
import { formatCents, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

function greeting(hour: number) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomePage() {
  const { user, hasRole } = useAuth();
  const { data, isLoading } = useDashboard();
  const firstName = user?.name.split(' ')[0];
  // Se calcula una vez al montar la página.
  const [{ today, salutation }] = useState(() => {
    const now = new Date();
    return {
      salutation: greeting(now.getHours()),
      today: new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now),
    };
  });

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-from via-brand-via to-brand-to p-6 text-white shadow-xl shadow-brand-from/20 sm:p-8">
        <div className="absolute -top-20 -right-10 size-72 rounded-full bg-brand-glow-1/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-brand-glow-2/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-white/80 capitalize">{today}</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {salutation}, {firstName}
            </h1>
            <p className="max-w-xl text-white/80">
              {user && ROLES[user.role].label} · así va el hotel hoy.
            </p>
          </div>
          {data?.occupancy && (
            <div className="text-right">
              <p className="text-5xl font-semibold tabular-nums">
                {data.occupancy.percent}%
              </p>
              <p className="text-sm text-white/80">
                ocupación · {data.occupancy.occupied} de{' '}
                {data.occupancy.sellable} habitaciones
              </p>
            </div>
          )}
          {data?.cleanedToday !== undefined && (
            <div className="text-right">
              <p className="text-5xl font-semibold tabular-nums">
                {data.cleanedToday}
              </p>
              <p className="text-sm text-white/80">limpiezas tuyas hoy</p>
            </div>
          )}
        </div>
      </section>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {data?.alerts && data.alerts.length > 0 && (
        <Alerts alerts={data.alerts} />
      )}

      {data?.frontDesk && data.money && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={LogIn}
            tone="text-sky-600 dark:text-sky-400 bg-sky-500/10"
            label="Llegadas pendientes"
            value={String(data.frontDesk.arrivals)}
            to="/recepcion"
          />
          <StatCard
            icon={LogOut}
            tone="text-amber-600 dark:text-amber-400 bg-amber-500/10"
            label="Salidas de hoy"
            value={String(data.frontDesk.departures)}
            hint={
              data.frontDesk.overdue
                ? `${data.frontDesk.overdue} vencida(s)`
                : undefined
            }
            to="/recepcion"
          />
          <StatCard
            icon={Wallet}
            tone="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            label="Cobrado hoy"
            value={formatCents(data.money.collectedTodayCents)}
            to={hasRole('ADMIN') ? '/caja/cortes' : '/caja'}
          />
          <StatCard
            icon={HandCoins}
            tone="text-rose-600 dark:text-rose-400 bg-rose-500/10"
            label="Por cobrar"
            value={formatCents(data.money.receivablesCents)}
            hint={`${data.money.receivablesCount} cuenta(s)`}
            to="/cuentas-por-cobrar"
          />
        </div>
      )}

      {data && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {data.forecast && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ocupación de los próximos 14 días</CardTitle>
                <CardDescription>
                  Reservas confirmadas y huéspedes en casa sobre habitaciones
                  vendibles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OccupancyChart days={data.forecast} />
              </CardContent>
            </Card>
          )}
          <RoomsCard data={data} wide={!data.forecast} />
          {hasRole('ADMIN') && <SystemStatusCard />}
        </div>
      )}
    </div>
  );
}

const ALERT_STYLE: Record<
  DashboardAlert['severity'],
  { icon: LucideIcon; className: string }
> = {
  danger: {
    icon: CircleAlert,
    className:
      'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300',
  },
  warning: {
    icon: AlertTriangle,
    className:
      'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  },
  info: {
    icon: Info,
    className: 'border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300',
  },
};

function Alerts({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {alerts.map((a) => {
        const { icon: Icon, className } = ALERT_STYLE[a.severity];
        const body = (
          <>
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 text-sm font-medium">{a.text}</span>
          </>
        );
        const cls = cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          className,
          a.link && 'transition-opacity hover:opacity-80',
        );
        return a.link ? (
          <Link key={a.kind + a.text} to={a.link} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={a.kind + a.text} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function RoomsCard({ data, wide }: { data: Dashboard; wide: boolean }) {
  const { rooms } = data;
  return (
    <Card className={cn(wide && 'lg:col-span-3')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="size-4 text-primary" />
          Habitaciones
        </CardTitle>
        <CardDescription>
          {rooms.total} activas · {rooms.sellable} vendibles hoy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra por estado: los segmentos llevan su etiqueta en la lista. */}
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
          {ROOM_STATUSES.filter((s) => rooms.byStatus[s] > 0).map((s) => (
            <span
              key={s}
              className={ROOM_STATUS[s].dot}
              style={{ flex: rooms.byStatus[s] }}
              title={`${ROOM_STATUS[s].label}: ${rooms.byStatus[s]}`}
            />
          ))}
        </div>
        <ul className="space-y-1.5 text-sm">
          {ROOM_STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn('size-2.5 rounded-full', ROOM_STATUS[s].dot)}
              />
              <span className="flex-1">{ROOM_STATUS[s].label}</span>
              <span className="font-medium tabular-nums">
                {rooms.byStatus[s]}
              </span>
            </li>
          ))}
        </ul>
        {rooms.overdueBlocks > 0 && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {rooms.overdueBlocks} bloqueo(s) con fecha de fin vencida
          </p>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
            Por limpiar ({rooms.toClean.length})
          </p>
          {rooms.toClean.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todo limpio por ahora.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {rooms.toClean.map((r) => (
                <span
                  key={r.id}
                  title={`${r.roomType} · desde ${formatRelative(r.since)}`}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-sm font-semibold tabular-nums"
                >
                  {r.number}
                </span>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={<Link to="/habitaciones" />}
          >
            Ver tablero de habitaciones
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemStatusCard() {
  const { data, isLoading, isError } = useHealth();
  const items = [
    {
      icon: Server,
      label: 'API',
      ok: !!data,
      text: isLoading ? 'Verificando…' : isError ? 'Sin conexión' : 'En línea',
    },
    {
      icon: Database,
      label: 'Base de datos',
      ok: data?.database === 'up',
      text: !data ? '—' : data.database === 'up' ? 'Conectada' : 'Sin conexión',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          Estado del sistema
        </CardTitle>
        <CardDescription>Se actualiza cada 30 segundos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ icon: Icon, label, ok, text }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{label}</span>
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                ok ? 'text-success' : 'text-destructive',
                isLoading && 'text-muted-foreground',
              )}
            >
              <span className="relative flex size-2">
                {ok && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
              {text}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
