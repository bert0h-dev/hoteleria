import { useState } from 'react';
import { Baby, BedDouble, Pencil, Plus, Tags, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useHotel } from '@/features/hotel/hotel-api';
import { AMENITIES } from '@/features/rooms/amenities';
import { RatesGrid } from '@/features/rooms/components/rates-grid';
import { RoomTypeFormDialog } from '@/features/rooms/components/room-type-form-dialog';
import { useRoomTypes } from '@/features/rooms/rooms-api';
import type { RoomType } from '@/features/rooms/types';
import { cn } from '@/lib/utils';

export function RoomTypesPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const { data: hotel } = useHotel();
  const { data: types, isLoading } = useRoomTypes(isAdmin);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoomType | null>(null);

  const openForm = (type: RoomType | null) => {
    setEditing(type);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos y tarifas"
        description="Cada tipo define su precio por noche; las demás tarifas se calculan automáticamente."
        actions={
          isAdmin && (
            <Button
              onClick={() => openForm(null)}
              className="shadow-md shadow-primary/20"
            >
              <Plus />
              Nuevo tipo
            </Button>
          )
        }
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      )}

      {types?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Tags className="size-6" />
          </div>
          <p className="font-medium">Aún no hay tipos de habitación</p>
          {isAdmin && (
            <Button size="sm" onClick={() => openForm(null)}>
              <Plus />
              Crear el primero
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {types?.map((type) => (
          <Card
            key={type.id}
            className={cn(
              'group relative gap-0 overflow-hidden p-0 transition-shadow hover:shadow-lg',
              !type.isActive && 'opacity-60',
            )}
          >
            <div className="relative h-24 overflow-hidden bg-linear-to-br from-brand-from via-brand-via to-brand-to p-5 text-white">
              <div className="absolute -top-10 -right-6 size-32 rounded-full bg-brand-glow-1/40 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold">
                    {type.name}
                  </h3>
                  <p className="flex items-center gap-1 text-sm text-white/80">
                    <BedDouble className="size-3.5" />
                    {type.roomCount ?? 0}{' '}
                    {type.roomCount === 1 ? 'habitación' : 'habitaciones'}
                  </p>
                </div>
                {!type.isActive && (
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">
                    Inactivo
                  </span>
                )}
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${type.name}`}
                    onClick={() => openForm(type)}
                    className="text-white hover:bg-white/15 hover:text-white"
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              {type.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {type.description}
                </p>
              )}

              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Users className="size-4 text-muted-foreground" />
                  {type.maxAdults} {type.maxAdults === 1 ? 'adulto' : 'adultos'}
                </span>
                {type.maxChildren > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Baby className="size-4 text-muted-foreground" />
                    {type.maxChildren}{' '}
                    {type.maxChildren === 1 ? 'niño' : 'niños'}
                  </span>
                )}
              </div>

              <RatesGrid rates={type.rates} settings={hotel?.settings} />

              {type.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {type.amenities.map((a) => {
                    const { label, icon: Icon } = AMENITIES[a];
                    return (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        <Icon className="size-3" />
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <RoomTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        roomType={editing}
      />
    </div>
  );
}
