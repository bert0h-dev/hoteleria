import {
  BedDouble,
  CalendarDays,
  ConciergeBell,
  FileBarChart,
  HandCoins,
  History,
  ScrollText,
  Sparkles,
  Wallet,
  Wrench,
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
    items: [
      { to: '/', label: 'Inicio', icon: LayoutDashboard },
      {
        to: '/recepcion',
        label: 'Recepción',
        icon: ConciergeBell,
        roles: ['ADMIN', 'RECEPTION'],
      },
      {
        to: '/caja',
        label: 'Caja',
        icon: Wallet,
        roles: ['ADMIN', 'RECEPTION'],
      },
      {
        to: '/cuentas-por-cobrar',
        label: 'Cuentas por cobrar',
        icon: HandCoins,
        roles: ['ADMIN', 'RECEPTION'],
      },
    ],
  },
  {
    title: 'Operación',
    items: [
      { to: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
      { to: '/limpieza', label: 'Limpieza', icon: Sparkles },
      {
        to: '/mantenimiento',
        label: 'Mantenimiento',
        icon: Wrench,
        roles: ['ADMIN', 'RECEPTION'],
      },
      { to: '/reportes', label: 'Reportes', icon: FileBarChart },
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
      {
        to: '/caja/cortes',
        label: 'Cortes de caja',
        icon: History,
        roles: ['ADMIN'],
      },
      {
        to: '/bitacora',
        label: 'Bitácora',
        icon: ScrollText,
        roles: ['ADMIN'],
      },
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
