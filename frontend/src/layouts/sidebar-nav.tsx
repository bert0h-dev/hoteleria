import { NavLink } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from './navigation';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRole } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => !i.roles || hasRole(...i.roles)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
            {section.title}
          </p>
          {section.items.map(({ to, label, icon: Icon, soon }) =>
            soon ? (
              <div
                key={to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/60"
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  Pronto
                </span>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={to === '/' || to === '/caja'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    isActive &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-primary',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}
