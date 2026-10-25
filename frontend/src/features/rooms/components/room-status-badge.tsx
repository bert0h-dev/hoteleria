import { cn } from '@/lib/utils';
import { ROOM_STATUS } from '../room-status';
import type { RoomStatus } from '../types';

export function RoomStatusBadge({
  status,
  className,
}: {
  status: RoomStatus;
  className?: string;
}) {
  const { label, icon: Icon, badge } = ROOM_STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badge,
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
