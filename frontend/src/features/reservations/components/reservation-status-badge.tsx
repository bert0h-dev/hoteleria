import { cn } from '@/lib/utils';
import { RESERVATION_STATUS, type ReservationStatus } from '../types';

export function ReservationStatusBadge({
  status,
  className,
}: {
  status: ReservationStatus;
  className?: string;
}) {
  const { label, icon: Icon, badge } = RESERVATION_STATUS[status];
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
