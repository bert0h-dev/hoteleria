import { NavLink, Outlet } from 'react-router';
import { LayoutGrid, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/habitaciones', label: 'Tablero', icon: LayoutGrid, end: true },
  {
    to: '/habitaciones/tipos',
    label: 'Tipos y tarifas',
    icon: Tags,
    end: false,
  },
];

/** Pestañas de la sección Habitaciones. */
export function RoomsLayout() {
  return (
    <div className="space-y-6">
      <nav className="inline-flex gap-1 rounded-xl border bg-muted/50 p-1">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground',
                isActive && 'bg-background text-foreground shadow-sm',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
