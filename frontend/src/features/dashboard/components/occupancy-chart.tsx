import { useState } from 'react';
import { dayParts } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ForecastDay } from '../dashboard-api';

const GRID = [0, 50, 100];

/**
 * Ocupación prevista por día (una sola serie: barras del color del tema,
 * con tooltip al pasar el cursor y tabla accesible).
 */
export function OccupancyChart({ days }: { days: ForecastDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover === null ? null : days[hover];

  return (
    <figure className="space-y-2">
      <div className="h-5 text-sm">
        {active ? (
          <span>
            <span className="font-medium capitalize">
              {dayParts(active.date).weekday} {dayParts(active.date).day}
            </span>
            <span className="text-muted-foreground">
              {' '}
              · {active.booked} de {active.sellable} habitaciones ·{' '}
            </span>
            <span className="font-semibold tabular-nums">
              {active.percent} %
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Pasa el cursor sobre un día para ver el detalle.
          </span>
        )}
      </div>

      <div className="relative h-44 pl-9">
        {/* Rejilla discreta */}
        {GRID.map((g) => (
          <div
            key={g}
            className="absolute right-0 left-9 border-t border-dashed border-border"
            style={{ bottom: `${g}%` }}
          >
            <span className="absolute -top-2 -left-9 w-7 text-right text-[10px] text-muted-foreground tabular-nums">
              {g}%
            </span>
          </div>
        ))}
        <div
          className="relative flex h-full items-end gap-0.5"
          onMouseLeave={() => setHover(null)}
        >
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${d.date}: ${d.percent} %`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group flex h-full flex-1 items-end outline-none"
            >
              <span
                className={cn(
                  'w-full rounded-t-[4px] bg-primary transition-opacity',
                  hover !== null && hover !== i && 'opacity-40',
                )}
                style={{ height: `${Math.max(d.percent, d.booked ? 2 : 0)}%` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-0.5 pl-9 text-center text-[10px] text-muted-foreground">
        {days.map((d, i) => (
          <span key={d.date} className="flex-1 tabular-nums">
            {i % 2 === 0 ? dayParts(d.date).day : ''}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Ocupación prevista</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th>{d.date}</th>
              <td>
                {d.booked} de {d.sellable} ({d.percent} %)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
