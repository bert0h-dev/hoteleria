import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Tarjeta de métrica: etiqueta, ícono con tono, valor y nota opcional. */
export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  to,
  loading,
}: {
  icon: LucideIcon;
  /** Clases de color del ícono, p. ej. `text-sky-600 dark:text-sky-400 bg-sky-500/10`. */
  tone: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Si se indica, la tarjeta entera es un enlace. */
  to?: string;
  loading?: boolean;
}) {
  const card = (
    <Card
      className={cn(
        'h-full gap-0 p-4',
        to && 'transition-colors group-hover:border-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg',
            tone,
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      )}
      <p className="h-4 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );

  return to ? (
    <Link to={to} className="group">
      {card}
    </Link>
  ) : (
    card
  );
}
