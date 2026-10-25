import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { COLOR_THEMES, useColorTheme } from './color-themes';

const MODES = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
] as const;

/** Selector de tema de color y modo claro/oscuro. */
export function ThemePicker() {
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme();
  const { theme: mode = 'system', setTheme: setMode } = useTheme();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Personalizar tema" />
        }
      >
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-b p-4">
          <p className="font-medium">Apariencia</p>
          <p className="text-xs text-muted-foreground">
            Se guarda en este navegador.
          </p>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Modo
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground',
                  mode === id && 'bg-background text-foreground shadow-sm',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Color
          </p>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_THEMES.map((t) => {
              const active = t.id === colorTheme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setColorTheme(t.id)}
                  aria-pressed={active}
                  // Las variables del tema se aplican solo a esta tarjeta.
                  data-theme={t.id}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border bg-background text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                    active && 'border-primary ring-2 ring-primary/30',
                  )}
                >
                  <ThemePreview />
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {t.label}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {t.description}
                      </p>
                    </div>
                    {active && (
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Miniatura de la app pintada con las variables del tema del contenedor. */
function ThemePreview() {
  return (
    <div className="flex h-16 gap-1.5 bg-muted/60 p-1.5">
      <div className="flex w-5 flex-col gap-1 rounded-md bg-sidebar p-1 ring-1 ring-border">
        <span className="size-3 rounded-sm bg-linear-to-br from-brand-from to-brand-to" />
        <span className="h-1 rounded-full bg-primary" />
        <span className="h-1 rounded-full bg-muted-foreground/30" />
        <span className="h-1 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="relative h-6 overflow-hidden rounded-md bg-linear-to-br from-brand-from via-brand-via to-brand-to">
          <span className="absolute -top-2 -right-1 size-5 rounded-full bg-brand-glow-1/60 blur-sm" />
        </div>
        <div className="flex flex-1 items-center gap-1 rounded-md bg-card px-1.5 ring-1 ring-border">
          <span className="h-1 flex-1 rounded-full bg-muted-foreground/25" />
          <span className="h-2.5 w-5 rounded-sm bg-primary" />
        </div>
      </div>
    </div>
  );
}
