import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Paleta de degradados; cada nombre obtiene siempre el mismo color.
const GRADIENTS = [
  'from-violet-500 to-indigo-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function gradientFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback
        className={cn(
          'bg-linear-to-br text-xs font-semibold text-white',
          gradientFor(name),
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
