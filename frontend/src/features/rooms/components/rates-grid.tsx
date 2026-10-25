import { CalendarRange, Clock, Moon, Sun } from 'lucide-react';
import type { PricingSettings, Rates } from '@/features/hotel/pricing';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Las 4 tarifas (hora, noche, día, semana) en mosaicos. */
export function RatesGrid({
  rates,
  settings,
  compact,
}: {
  rates: Rates;
  settings?: Pick<PricingSettings, 'minHours' | 'dayDurationHours'>;
  compact?: boolean;
}) {
  const items = [
    {
      icon: Clock,
      label: 'Hora',
      value: rates.hourly,
      hint: settings && `mín. ${settings.minHours} h`,
    },
    { icon: Moon, label: 'Noche', value: rates.nightly, hint: 'base' },
    {
      icon: Sun,
      label: 'Día',
      value: rates.daily,
      hint: settings && `${settings.dayDurationHours} h`,
    },
    {
      icon: CalendarRange,
      label: 'Semana',
      value: rates.weekly,
      hint: '7 noches',
    },
  ];

  return (
    <div className={cn('grid grid-cols-4 gap-1.5', compact && 'gap-1')}>
      {items.map(({ icon: Icon, label, value, hint }) => (
        <div
          key={label}
          className={cn(
            'rounded-lg border bg-muted/40 px-2 py-1.5 text-center',
            label === 'Noche' && 'border-primary/30 bg-primary/5',
          )}
        >
          <p className="flex items-center justify-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <Icon className="size-3" />
            {label}
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatMoney(value)}
          </p>
          {!compact && hint && (
            <p className="text-[10px] text-muted-foreground">{hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
