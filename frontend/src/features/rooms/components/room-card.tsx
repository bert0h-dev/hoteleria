import { AlertTriangle, CalendarClock, Sparkles } from 'lucide-react';
import { formatDay, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isBlockingStatus, ROOM_STATUS } from '../room-status';
import type { Room } from '../types';

export function RoomCard({
  room,
  onClick,
}: {
  room: Room;
  onClick: () => void;
}) {
  const style = ROOM_STATUS[room.status];
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        style.card,
        room.blockOverdue && 'border-destructive/60',
        !room.isActive && 'border-dashed opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">
          {room.number}
        </span>
        <span className="relative flex size-2.5">
          {room.status === 'CLEANING' && (
            <span
              className={cn(
                'absolute inline-flex size-full animate-ping rounded-full opacity-70',
                style.dot,
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full',
              style.dot,
            )}
          />
        </span>
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{room.roomType.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="size-3" />
          {room.isActive ? style.label : 'Dada de baja'}
        </p>
      </div>

      {room.isActive && isBlockingStatus(room.status) && (
        <p
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            room.blockOverdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {room.blockOverdue ? (
            <AlertTriangle className="size-3 shrink-0" />
          ) : (
            <CalendarClock className="size-3 shrink-0" />
          )}
          {room.blockOverdue
            ? 'Vencido · ' + formatDay(room.blockedUntil!)
            : room.blockedUntil
              ? 'Hasta ' + formatDay(room.blockedUntil)
              : 'Indefinido'}
        </p>
      )}

      {room.lastCleanedBy && room.lastCleanedAt && (
        <p
          className="flex items-center gap-1 truncate border-t pt-2 text-[11px] text-muted-foreground"
          title={`Última limpieza: ${room.lastCleanedBy.name}`}
        >
          <Sparkles className="size-3 shrink-0" />
          <span className="truncate">
            {room.lastCleanedBy.name.split(' ')[0]} ·{' '}
            {formatRelative(room.lastCleanedAt)}
          </span>
        </p>
      )}
    </button>
  );
}
