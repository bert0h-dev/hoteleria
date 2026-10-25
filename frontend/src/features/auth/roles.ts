import type { Role } from './types';

export const ROLES: Record<Role, { label: string; badgeClass: string }> = {
  ADMIN: {
    label: 'Administrador',
    badgeClass:
      'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  },
  RECEPTION: {
    label: 'Recepción',
    badgeClass: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  },
  HOUSEKEEPING: {
    label: 'Limpieza',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  },
};

export const ROLE_OPTIONS = (Object.keys(ROLES) as Role[]).map((value) => ({
  value,
  label: ROLES[value].label,
}));
