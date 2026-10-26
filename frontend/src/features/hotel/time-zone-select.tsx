import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { timeIn } from '@/lib/format';

// Zonas horarias de México (IANA).
const MEXICO_TIME_ZONES = [
  {
    value: 'America/Mexico_City',
    label: 'Centro',
    cities: 'CDMX, Guadalajara, Monterrey',
  },
  { value: 'America/Cancun', label: 'Sureste', cities: 'Cancún, Quintana Roo' },
  { value: 'America/Mazatlan', label: 'Pacífico', cities: 'Mazatlán, La Paz' },
  { value: 'America/Chihuahua', label: 'Chihuahua', cities: 'Chihuahua' },
  { value: 'America/Hermosillo', label: 'Sonora', cities: 'Hermosillo' },
  { value: 'America/Tijuana', label: 'Noroeste', cities: 'Tijuana, Mexicali' },
];

export function TimeZoneSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // La hora de cada zona se calcula al abrir la página.
  const [now] = useState(() => new Date());

  const items = MEXICO_TIME_ZONES.map((z) => ({
    value: z.value,
    label: `${z.label} (${z.cities}) · ${timeIn(z.value, now)}`,
  }));
  // Si el hotel tiene otra zona válida, se conserva en la lista.
  if (value && !items.some((i) => i.value === value)) {
    items.push({ value, label: `${value} · ${timeIn(value, now)}` });
  }

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => v && onChange(v as string)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((z) => (
          <SelectItem key={z.value} value={z.value}>
            {z.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
