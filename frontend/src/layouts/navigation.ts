import {
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/features/auth/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Si se indica, solo esos roles ven la opción. */
  roles?: Role[];
  /** Módulo de una fase futura: se muestra deshabilitado. */
  soon?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'General',
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard }],
  },
  {
    title: 'Operación',
    items: [
      {
        to: '/habitaciones',
        label: 'Habitaciones',
        icon: BedDouble,
        soon: true,
      },
      { to: '/reservas', label: 'Reservas', icon: CalendarDays, soon: true },
      { to: '/huespedes', label: 'Huéspedes', icon: UsersRound, soon: true },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
    ],
  },
];
