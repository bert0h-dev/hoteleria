import { useState } from 'react';
import {
  Activity,
  BedDouble,
  CreditCard,
  Database,
  Server,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { ROLES } from '@/features/auth/roles';
import { useHealth } from '@/features/health/use-health';
import { cn } from '@/lib/utils';

function greeting(hour: number) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const UPCOMING = [
  {
    icon: BedDouble,
    title: 'Check-in / Check-out',
    text: 'Entradas y salidas del día',
    phase: 6,
  },
  {
    icon: CreditCard,
    title: 'Cobros',
    text: 'Cargos, pagos y folios',
    phase: 7,
  },
];

export function HomePage() {
  const { user, hasRole } = useAuth();
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
    <div className="space-y-8">
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
              Has iniciado sesión como{' '}
              <span className="font-medium text-white">
                {user && ROLES[user.role].label}
              </span>
              . Aquí verás el resumen de la operación del hotel.
            </p>
          </div>
          {hasRole('ADMIN') && (
            <Button
              render={<Link to="/usuarios" />}
              className="bg-white text-brand-via hover:bg-white/90"
            >
              Administrar usuarios
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximos módulos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximos módulos</CardTitle>
            <CardDescription>
              Lo que viene en las siguientes fases del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {UPCOMING.map(({ icon: Icon, title, text, phase }) => (
              <div
                key={title}
                className="group flex items-center gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {text}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Fase {phase}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <SystemStatusCard />
      </div>
    </div>
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
