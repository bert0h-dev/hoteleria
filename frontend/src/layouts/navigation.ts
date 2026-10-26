import {
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  Settings,
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
      { to: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
      {
        to: '/reservas',
        label: 'Reservas',
        icon: CalendarDays,
        roles: ['ADMIN', 'RECEPTION'],
      },
      {
        to: '/huespedes',
        label: 'Huéspedes',
        icon: UsersRound,
        roles: ['ADMIN', 'RECEPTION'],
      },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
      {
        to: '/configuracion',
        label: 'Configuración',
        icon: Settings,
        roles: ['ADMIN'],
      },
    ],
  },
];
