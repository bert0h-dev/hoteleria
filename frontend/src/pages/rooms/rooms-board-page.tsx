import { useMemo, useState } from 'react';
import { BedDouble, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { RoomCard } from '@/features/rooms/components/room-card';
import { RoomFormDialog } from '@/features/rooms/components/room-form-dialog';
import { RoomDetailsDialog } from '@/features/rooms/components/room-details-dialog';
import { ROOM_STATUS, ROOM_STATUSES } from '@/features/rooms/room-status';
import {
  useRoomSummary,
  useRooms,
  useRoomTypes,
} from '@/features/rooms/rooms-api';
import type { Room, RoomStatus } from '@/features/rooms/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';

const ALL = 'all';

export function RoomsBoardPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [typeId, setTypeId] = useState(ALL);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);

  const summary = useRoomSummary();
  const { data: types = [] } = useRoomTypes();
  const { data: rooms, isLoading } = useRooms({
    status: status ?? undefined,
    roomTypeId: typeId === ALL ? undefined : typeId,
    search: debouncedSearch || undefined,
    includeInactive: isAdmin && showInactive ? true : undefined,
  });

  // Agrupa por piso para el tablero.
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    for (const room of rooms ?? []) {
      map.set(room.floor, [...(map.get(room.floor) ?? []), room]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [rooms]);

  // La habitación seleccionada se toma de la lista para verla siempre al día.
  const selected = rooms?.find((r) => r.id === selectedId) ?? null;
  const typeItems = [
    { value: ALL, label: 'Todos los tipos' },
    ...types.map((t) => ({ value: t.id, label: t.name })),
  ];
  const hasFilters = !!status || typeId !== ALL || !!search;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habitaciones"
        description="Estado en tiempo real de todas las habitaciones del hotel."
        actions={
          isAdmin && (
            <Button
              onClick={openCreate}
              className="shadow-md shadow-primary/20"
            >
              <Plus />
              Nueva habitación
            </Button>
          )
        }
      />

      {/* Contadores por estado (también filtran) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ROOM_STATUSES.map((s) => {
          const { label, icon: Icon, dot } = ROOM_STATUS[s];
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(active ? null : s)}
              aria-pressed={active}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                active && 'border-primary ring-2 ring-primary/25',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-lg text-white',
                    dot,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              {summary.isLoading ? (
                <Skeleton className="mt-2 h-8 w-10" />
              ) : (
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {summary.data?.byStatus[s] ?? 0}
                </p>
              )}
              {summary.data && summary.data.total > 0 && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', dot)}
                    style={{
                      width: `${((summary.data.byStatus[s] ?? 0) / summary.data.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar número…"
            className="pl-9"
            aria-label="Buscar habitación"
          />
        </div>
        <Select
          items={typeItems}
          value={typeId}
          onValueChange={(v) => v && setTypeId(v as string)}
        >
          <SelectTrigger
            className="w-full sm:w-48"
            aria-label="Filtrar por tipo"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Mostrar dadas de baja
          </label>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus(null);
              setTypeId(ALL);
              setSearch('');
            }}
          >
            <X />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tablero por piso */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && floors.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <BedDouble className="size-6" />
          </div>
          <p className="font-medium">
            {hasFilters ? 'Sin resultados' : 'Aún no hay habitaciones'}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'Ninguna habitación coincide con los filtros.'
              : isAdmin
                ? 'Crea primero los tipos de habitación y después las habitaciones.'
                : 'Un administrador debe dar de alta las habitaciones.'}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {floors.map(([floor, floorRooms]) => (
          <section key={floor} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">
                {floor === 0 ? 'Planta baja' : `Piso ${floor}`}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {floorRooms.length}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {floorRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => setSelectedId(room.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <RoomDetailsDialog
        room={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onEdit={(room) => {
          setEditing(room);
          setFormOpen(true);
        }}
      />
      <RoomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        room={editing}
      />
    </div>
  );
}
