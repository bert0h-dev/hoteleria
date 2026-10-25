import { BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20',
        className,
      )}
    >
      <BedDouble className="size-[55%]" strokeWidth={2.2} />
    </div>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <p className="font-semibold tracking-tight">Hotelería</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
