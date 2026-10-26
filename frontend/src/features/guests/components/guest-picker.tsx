import { useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { useGuests } from '../guests-api';
import { fullName, type Guest } from '../types';
import { GuestBadges } from './guest-badges';
import { GuestFormDialog } from './guest-form-dialog';

/**
 * Buscar o crear huésped. Se usa al registrar reservas y estancias:
 * busca mientras se escribe y, si no existe, permite registrarlo sin salir
 * de la pantalla. Los huéspedes bloqueados aparecen pero no se pueden elegir.
 */
export function GuestPicker({
  value,
  onChange,
  invalid,
}: {
  value: Guest | null;
  onChange: (guest: Guest | null) => void;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const search = useDebouncedValue(query.trim(), 250);
  const { data, isFetching } = useGuests({
    page: 1,
    limit: 6,
    search: search || undefined,
  });

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <UserAvatar name={fullName(value)} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-medium">
            {fullName(value)}
            <GuestBadges guest={value} />
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {value.phone ?? value.email}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cambiar huésped"
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      </div>
    );
  }

  const results = search ? (data?.data ?? []) : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por nombre, teléfono, correo o identificación…"
          className="pl-9"
          aria-invalid={invalid}
          aria-label="Buscar huésped"
        />
        {isFetching && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {search && (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {results.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                disabled={g.isBlocked}
                onClick={() => onChange(g)}
                className={cn(
                  'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted',
                  g.isBlocked &&
                    'cursor-not-allowed opacity-60 hover:bg-transparent',
                )}
              >
                <UserAvatar name={fullName(g)} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {fullName(g)}
                    <GuestBadges guest={g} />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[g.phone, g.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && !isFetching && (
            <li className="p-3 text-sm text-muted-foreground">
              No se encontró a «{search}».
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium text-primary hover:bg-primary/5"
            >
              <UserPlus className="size-4" />
              Registrar nuevo huésped
            </button>
          </li>
        </ul>
      )}

      <GuestFormDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={/\d|@/.test(search) ? undefined : search}
        onSaved={onChange}
        onUseExisting={onChange}
      />
    </div>
  );
}
