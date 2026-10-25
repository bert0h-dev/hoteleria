import { NavLink, Outlet } from 'react-router';
import { Hotel, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [{ to: '/', label: 'Inicio', icon: LayoutDashboard }];

export function MainLayout() {
  return (
    <div className="flex min-h-svh bg-muted/40">
      <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Hotel className="size-5" />
          Hotelería
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted',
                  isActive && 'bg-muted font-medium text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b bg-background px-6">
          <span className="font-medium md:hidden">Hotelería</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
