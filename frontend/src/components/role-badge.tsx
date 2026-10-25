import { ROLES } from '@/features/auth/roles';
import type { Role } from '@/features/auth/types';
import { cn } from '@/lib/utils';

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        ROLES[role].badgeClass,
      )}
    >
      {ROLES[role].label}
    </span>
  );
}
