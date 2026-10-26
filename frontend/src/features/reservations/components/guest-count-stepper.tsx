import { Baby, Minus, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Botones − / + para adultos y niños. */
export interface GuestCount {
  adults: number;
  children: number;
}

export function GuestCountStepper({
  value,
  onChange,
}: {
  value: GuestCount;
  onChange: (value: GuestCount) => void;
}) {
  const { adults, children } = value;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stepper
        icon={Users}
        label="Adultos"
        value={adults}
        min={1}
        onChange={(n) => onChange({ adults: n, children })}
      />
      <Stepper
        icon={Baby}
        label="Niños"
        value={children}
        min={0}
        onChange={(n) => onChange({ adults, children: n })}
      />
    </div>
  );
}

function Stepper({
  icon: Icon,
  label,
  value,
  min,
  onChange,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-2 pl-3">
      <span className="flex items-center gap-1.5 text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </Button>
        <span className="w-6 text-center font-semibold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={value >= 20}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
