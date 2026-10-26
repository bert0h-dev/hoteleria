import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { fullName, type DuplicateGuest, type DuplicateReason } from '../types';

const REASONS: Record<DuplicateReason, string> = {
  phone: 'mismo teléfono',
  email: 'mismo correo',
  document: 'misma identificación',
};

/** Aviso de posibles huéspedes repetidos, con opción de usar el existente. */
export function DuplicatesAlert({
  duplicates,
  onUse,
}: {
  duplicates: DuplicateGuest[];
  onUse?: (guest: DuplicateGuest) => void;
}) {
  if (duplicates.length === 0) return null;
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-4" />
        {duplicates.length === 1
          ? 'Este huésped podría estar registrado'
          : 'Estos huéspedes podrían ser la misma persona'}
      </p>
      <ul className="space-y-2">
        {duplicates.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-lg bg-background/80 p-2"
          >
            <UserAvatar name={fullName(d)} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName(d)}</p>
              <p className="truncate text-xs text-muted-foreground">
                Coincide: {d.reasons.map((r) => REASONS[r]).join(', ')}
              </p>
            </div>
            {onUse && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onUse(d)}
              >
                Usar este
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
