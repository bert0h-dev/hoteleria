import { NavLink, Outlet } from 'react-router';
import { CalendarDays, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/reservas', label: 'Calendario', icon: CalendarDays, end: true },
  { to: '/reservas/lista', label: 'Lista', icon: List, end: false },
];

export function ReservationsLayout() {
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
