import { CalendarClock, Infinity as InfinityIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDays, formatDay, todayInHotel } from '@/lib/format';
import { cn } from '@/lib/utils';

const SHORTCUTS = [
  { label: 'Mañana', days: 1 },
  { label: '3 días', days: 3 },
  { label: '1 semana', days: 7 },
];

/**
 * Fecha estimada de fin de un bloqueo (último día bloqueado, inclusive).
 * `value = null` significa "indefinido" y solo se ofrece si `allowIndefinite`.
 */
export function BlockedUntilPicker({
  id,
  value,
  onChange,
  allowIndefinite,
  invalid,
}: {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  allowIndefinite: boolean;
  invalid?: boolean;
}) {
  const today = todayInHotel();

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted',
      active && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
    );

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <CalendarClock className="size-3.5" />
        Hasta el día{' '}
        {!allowIndefinite && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {SHORTCUTS.map(({ label, days }) => {
          const date = addDays(today, days);
          return (
            <button
              key={label}
              type="button"
              className={chip(value === date)}
              onClick={() => onChange(date)}
            >
              {label}
            </button>
          );
        })}
        {allowIndefinite && (
          <button
            type="button"
            className={chip(value === null)}
            onClick={() => onChange(null)}
          >
            <InfinityIcon className="size-3" />
            Indefinido
          </button>
        )}
      </div>
      <Input
        id={id}
        type="date"
        min={today}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-invalid={invalid}
      />
      <p className="text-xs text-muted-foreground">
        {value
          ? `Bloqueada hasta el ${formatDay(value)} (inclusive). Si llega la fecha y sigue igual, se marcará como vencida.`
          : allowIndefinite
            ? 'Sin fecha estimada: quedará bloqueada hasta que alguien la libere.'
            : 'Elige el último día que estará bloqueada.'}
      </p>
    </div>
  );
}
