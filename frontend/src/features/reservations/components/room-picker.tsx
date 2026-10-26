import { ArrowUpCircle, BedDouble, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AssignableRoom } from '../types';

/**
 * Habitaciones disponibles en tarjetas por piso: primero las del tipo
 * reservado y después las de otros tipos (mejora de categoría, con motivo).
 */
export function RoomPicker({
  rooms,
  isLoading,
  value,
  onChange,
  reason,
  onReasonChange,
  reasonError,
}: {
  rooms: AssignableRoom[] | undefined;
  isLoading: boolean;
  value: string | null;
  onChange: (roomId: string) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  reasonError?: string | null;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const same = (rooms ?? []).filter((r) => !r.upgrade);
  const upgrades = (rooms ?? []).filter((r) => r.upgrade && r.assignable);
  const selected = rooms?.find((r) => r.id === value);

  if (!rooms?.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hay habitaciones disponibles (limpias y libres) en este momento.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {same.length ? (
        <Grid rooms={same} value={value} onChange={onChange} />
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No hay habitaciones limpias del tipo reservado. Puedes asignar una de
          otro tipo como mejora de categoría.
        </p>
      )}

      {upgrades.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <ArrowUpCircle className="size-3.5" />
            Mejora de categoría (mismo precio)
          </p>
          <Grid rooms={upgrades} value={value} onChange={onChange} upgrade />
        </div>
      )}

      {selected?.upgrade && (
        <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <Label htmlFor="upgrade-reason">
            Motivo de la mejora a «{selected.roomType.name}»
          </Label>
          <Textarea
            id="upgrade-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ej. no había Dobles limpias, cliente frecuente…"
            aria-invalid={!!reasonError}
          />
          {reasonError && (
            <p className="text-sm text-destructive">{reasonError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Grid({
  rooms,
  value,
  onChange,
  upgrade,
}: {
  rooms: AssignableRoom[];
  value: string | null;
  onChange: (roomId: string) => void;
  upgrade?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {rooms.map((r) => {
        const active = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(r.id)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-xl border-2 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
              upgrade
                ? 'border-violet-500/30 bg-violet-500/[0.06]'
                : 'border-emerald-500/30 bg-emerald-500/[0.06]',
              active && 'border-primary ring-2 ring-primary/30',
            )}
          >
            <span className="flex w-full items-center justify-between">
              <span className="text-lg leading-none font-bold tabular-nums">
                {r.number}
              </span>
              <BedDouble className="size-3.5 text-muted-foreground" />
            </span>
            <span className="text-[11px] text-muted-foreground">
              Piso {r.floor}
              {upgrade && ` · ${r.roomType.name}`}
            </span>
            {r.lastCleanedAt && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Sparkles className="size-2.5" />
                {formatRelative(r.lastCleanedAt)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
