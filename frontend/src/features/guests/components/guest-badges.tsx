import { Ban, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Guest } from '../types';

export function GuestBadges({
  guest,
  className,
}: {
  guest: Pick<Guest, 'isVip' | 'isBlocked'>;
  className?: string;
}) {
  if (!guest.isVip && !guest.isBlocked) return null;
  return (
    <span className={cn('inline-flex gap-1', className)}>
      {guest.isVip && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-500/30 ring-inset dark:text-amber-300">
          <Crown className="size-3" />
          VIP
        </span>
      )}
      {guest.isBlocked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive ring-1 ring-destructive/30 ring-inset">
          <Ban className="size-3" />
          Bloqueado
        </span>
      )}
    </span>
  );
}
