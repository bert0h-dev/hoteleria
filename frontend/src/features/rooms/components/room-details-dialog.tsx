import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Layers,
  Loader2,
  Pencil,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';
import {
  addDays,
  formatDateTime,
  formatDay,
  formatMoney,
  formatRelative,
  todayInHotel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  allowedTargets,
  completesCleaning,
  isBlockingStatus,
  requiresBlockedUntil,
  requiresReason,
  ROOM_STATUS,
} from '../room-status';
import {
  useChangeRoomStatus,
  useHousekeepers,
  useRoomHistory,
  useUpdateBlockedUntil,
} from '../rooms-api';
import type { Room, RoomStatus } from '../types';
import { BlockedUntilPicker } from './blocked-until-picker';
import { RoomStatusBadge } from './room-status-badge';

const SELF = 'self';
// Registros visibles del historial antes de que aparezca el scroll.
const MAX_VISIBLE_HISTORY = 8;

/** Detalle de la habitación en un diálogo centrado. */
export function RoomDetailsDialog({
  room,
  onOpenChange,
  onEdit,
}: {
  room: Room | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (room: Room) => void;
}) {
  return (
    <Dialog open={!!room} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {room && <RoomDetails key={room.id} room={room} onEdit={onEdit} />}
      </DialogContent>
    </Dialog>
  );
}

function RoomDetails({
  room,
  onEdit,
}: {
  room: Room;
  onEdit?: (room: Room) => void;
}) {
  const { user, hasRole } = useAuth();
  const style = ROOM_STATUS[room.status];

  return (
    <>
      <DialogHeader className="relative shrink-0 overflow-hidden border-b p-6">
        <div
          className={cn(
            'absolute -top-16 -right-16 size-48 rounded-full opacity-20 blur-3xl',
            style.dot,
          )}
        />
        <div className="relative flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl border-2 bg-background text-2xl font-bold tabular-nums">
            {room.number}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <DialogTitle className="text-lg">
              Habitación {room.number}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {room.roomType.name} · {formatMoney(room.roomType.nightlyRate)} /
              noche
            </DialogDescription>
            <RoomStatusBadge status={room.status} />
          </div>
        </div>
      </DialogHeader>

      {/* Escritorio: datos y estado a la izquierda, historial a la derecha.
          Celular: una sola columna con scroll. */}
      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:grid-rows-1 md:overflow-hidden">
        <div className="min-h-0 space-y-6 p-6 md:overflow-y-auto">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info icon={Layers} label="Piso" value={String(room.floor)} />
            <Info
              icon={Sparkles}
              label="Última limpieza"
              value={
                room.lastCleanedBy && room.lastCleanedAt
                  ? `${room.lastCleanedBy.name} · ${formatRelative(room.lastCleanedAt)}`
                  : 'Sin registro'
              }
            />
            {isBlockingStatus(room.status) && (
              <div className="col-span-2">
                <BlockedUntilInfo
                  room={room}
                  canEdit={hasRole('ADMIN', 'RECEPTION')}
                />
              </div>
            )}
            {room.notes && (
              <div className="col-span-2">
                <Info icon={StickyNote} label="Notas" value={room.notes} />
              </div>
            )}
          </dl>

          {room.isActive && user && (
            <StatusChanger key={room.status} room={room} role={user.role} />
          )}

          {hasRole('ADMIN') && onEdit && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onEdit(room)}
            >
              <Pencil />
              Editar habitación
            </Button>
          )}
        </div>

        <div className="min-h-0 border-t bg-muted/20 p-6 md:overflow-y-auto md:border-t-0 md:border-l">
          <History roomId={room.id} />
        </div>
      </div>
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 font-medium break-words">{value}</dd>
    </div>
  );
}

function StatusChanger({
  room,
  role,
}: {
  room: Room;
  role: 'ADMIN' | 'RECEPTION' | 'HOUSEKEEPING';
}) {
  const targets = allowedTargets(role, room.status);
  const [target, setTarget] = useState<RoomStatus | null>(
    targets.length === 1 ? targets[0] : null,
  );
  const [reason, setReason] = useState('');
  const [cleaner, setCleaner] = useState(SELF);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changeStatus = useChangeRoomStatus();

  const finishingCleaning = !!target && completesCleaning(room.status, target);
  const pickCleaner = finishingCleaning && role !== 'HOUSEKEEPING';
  const housekeepers = useHousekeepers(pickCleaner);
  const reasonRequired = !!target && requiresReason(target);

  if (targets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Tu rol no puede cambiar el estado de esta habitación.
      </p>
    );
  }

  const submit = async () => {
    if (!target) return;
    if (reasonRequired && !reason.trim()) {
      setError('Escribe el motivo del cambio');
      return;
    }
    if (requiresBlockedUntil(target) && !blockedUntil) {
      setError('Elige hasta qué día estará bloqueada');
      return;
    }
    setError(null);
    try {
      await changeStatus.mutateAsync({
        id: room.id,
        status: target,
        reason: reason.trim() || undefined,
        cleanedById: pickCleaner && cleaner !== SELF ? cleaner : undefined,
        blockedUntil:
          isBlockingStatus(target) && blockedUntil ? blockedUntil : undefined,
      });
      toast.success(
        `Habitación ${room.number}: ${ROOM_STATUS[target].label.toLowerCase()}`,
      );
      setReason('');
      setTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const cleanerItems = [
    { value: SELF, label: 'Yo' },
    ...(housekeepers.data ?? []).map((h) => ({ value: h.id, label: h.name })),
  ];

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Cambiar estado</h3>
      <div className="grid grid-cols-2 gap-2">
        {targets.map((s) => {
          const { label, icon: Icon, dot } = ROOM_STATUS[s];
          const active = target === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setTarget(s);
                setError(null);
                // Mantenimiento propone 3 días; Fuera de servicio, indefinido.
                setBlockedUntil(
                  requiresBlockedUntil(s) ? addDays(todayInHotel(), 3) : null,
                );
              }}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all hover:bg-muted',
                active && 'border-primary bg-primary/5 ring-2 ring-primary/20',
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', dot)} />
              <Icon className="size-3.5 text-muted-foreground" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {target && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RoomStatusBadge status={room.status} />
            <ArrowRight className="size-3" />
            <RoomStatusBadge status={target} />
          </div>

          {pickCleaner && (
            <div className="space-y-1.5">
              <Label htmlFor="cleaner">¿Quién limpió?</Label>
              <Select
                items={cleanerItems}
                value={cleaner}
                onValueChange={(v) => v && setCleaner(v as string)}
              >
                <SelectTrigger id="cleaner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cleanerItems.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isBlockingStatus(target) && (
            <BlockedUntilPicker
              id="blocked-until"
              value={blockedUntil}
              onChange={setBlockedUntil}
              allowIndefinite={!requiresBlockedUntil(target)}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Motivo{' '}
              {!reasonRequired && (
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                reasonRequired ? 'Ej. fuga en el lavabo' : 'Agrega una nota…'
              }
              rows={2}
              maxLength={300}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={changeStatus.isPending}
          >
            {changeStatus.isPending && <Loader2 className="animate-spin" />}
            {finishingCleaning
              ? 'Terminar limpieza'
              : `Cambiar a ${ROOM_STATUS[target].label.toLowerCase()}`}
          </Button>
        </div>
      )}
    </section>
  );
}

function History({ roomId }: { roomId: string }) {
  const { data, isLoading } = useRoomHistory(roomId);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        Historial
        {!!data?.length && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {data.length} {data.length === 1 ? 'cambio' : 'cambios'}
          </span>
        )}
      </h3>
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no hay cambios de estado.
        </p>
      )}
      {/* Alto para ~8 registros; después, scroll solo dentro de la lista. */}
      <div className="relative">
        <div className="max-h-[34rem] overflow-y-auto pr-2 pl-2">
          <ol className="relative space-y-4 border-l pl-5">
            {data?.map((log) => {
              const to = ROOM_STATUS[log.toStatus];
              const isDateAdjust = log.fromStatus === log.toStatus;
              return (
                <li key={log.id} className="relative">
                  <span
                    className={cn(
                      'absolute top-1 -left-[26px] size-3 rounded-full ring-4 ring-background',
                      to.dot,
                    )}
                  />
                  {isDateAdjust ? (
                    <p className="text-sm">
                      <span className="font-medium">{log.changedBy.name}</span>{' '}
                      <span className="text-muted-foreground">
                        ajustó la fecha estimada:
                      </span>{' '}
                      {dayOrIndefinite(log.previousBlockedUntil)} →{' '}
                      <span className="font-medium">
                        {dayOrIndefinite(log.blockedUntil)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span className="font-medium">{log.changedBy.name}</span>{' '}
                      <span className="text-muted-foreground">cambió de</span>{' '}
                      {ROOM_STATUS[log.fromStatus].label.toLowerCase()}{' '}
                      <span className="text-muted-foreground">a</span>{' '}
                      <span className="font-medium">
                        {to.label.toLowerCase()}
                      </span>
                      {isBlockingStatus(log.toStatus) && (
                        <span className="text-muted-foreground">
                          {' '}
                          · hasta {dayOrIndefinite(log.blockedUntil)}
                        </span>
                      )}
                    </p>
                  )}
                  {log.cleanedBy && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <Sparkles className="size-3" />
                      Limpió {log.cleanedBy.name}
                      {log.cleanedAt && ` · ${formatDateTime(log.cleanedAt)}`}
                    </p>
                  )}
                  {log.reason && (
                    <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">
                      {log.reason}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
        {(data?.length ?? 0) > MAX_VISIBLE_HISTORY && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-popover to-transparent" />
        )}
      </div>
    </section>
  );
}

function dayOrIndefinite(date: string | null) {
  return date ? formatDay(date) : 'indefinido';
}

/** Fecha estimada del bloqueo, con aviso de vencido y opción de ajustarla. */
function BlockedUntilInfo({ room, canEdit }: { room: Room; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string | null>(room.blockedUntil);
  const update = useUpdateBlockedUntil();
  const required = requiresBlockedUntil(room.status);

  const save = async () => {
    try {
      await update.mutateAsync({ id: room.id, blockedUntil: value });
      toast.success('Fecha estimada actualizada');
      setEditing(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/30 p-3',
        room.blockOverdue && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Fecha estimada de fin
          </dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium">
            {room.blockedUntil
              ? 'Hasta el ' + formatDay(room.blockedUntil)
              : 'Indefinido'}
            {room.blockOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3" />
                Vencido
              </span>
            )}
          </dd>
        </div>
        {canEdit && !editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setValue(room.blockedUntil);
              setEditing(true);
            }}
          >
            Ajustar fecha
          </Button>
        )}
      </div>
      {room.blockOverdue && !editing && (
        <p className="mt-2 text-xs text-muted-foreground">
          La fecha ya pasó. Libera la habitación si ya está lista o ajusta la
          fecha.
        </p>
      )}
      {editing && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <BlockedUntilPicker
            id="adjust-blocked-until"
            value={value}
            onChange={setValue}
            allowIndefinite={!required}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={update.isPending || (required && !value)}
            >
              {update.isPending && <Loader2 className="animate-spin" />}
              Guardar fecha
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
