import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_OPTIONS } from '@/features/auth/roles';
import type { Role } from '@/features/auth/types';

export function RoleSelect({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id?: string;
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Select
      items={ROLE_OPTIONS}
      value={value}
      onValueChange={(v) => v && onChange(v as Role)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
