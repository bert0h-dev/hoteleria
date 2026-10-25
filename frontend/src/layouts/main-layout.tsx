import { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemePicker } from '@/features/theme/theme-picker';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-svh bg-background">
      {/* Menú lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo subtitle="Panel de gestión" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>
        <div className="m-3 rounded-xl border border-sidebar-border bg-linear-to-br from-brand-from/12 to-brand-to/5 p-4">
          <p className="text-sm font-medium">Fase 2 de 9</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pronto: habitaciones, reservas y huéspedes.
          </p>
        </div>
      </aside>

      {/* Menú lateral (móvil) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="h-16 justify-center px-5">
            <SheetTitle render={<div />}>
              <Logo subtitle="Panel de gestión" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              Menú de navegación
            </SheetDescription>
          </SheetHeader>
          <div className="px-3 py-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemePicker />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
